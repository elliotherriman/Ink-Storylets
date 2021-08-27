const storylet_knotTag = "storylet";

const storylet_openStitch = "open";
const storylet_urgencyStitch = "urgency";
const storylet_exclusivityStitch = "exclusivity";
const storylet_contentStitch = "text";

const storylet_function_open = "_openStorylets";
const storylet_function_filtered = "_filteredStorylets";

inkjs.Story = class Story extends inkjs.Story
{
	constructor(content)
	{
		super(content);
		
		InitialiseStorylets.bind(this)();

		this.BindExternalFunction(storylet_function_open, OpenStorylets.bind(this));

		this.BindExternalFunction(storylet_function_filtered, (category) => OpenStorylets.bind(this)(category));
	}
}

function InitialiseStorylets(tag = storylet_knotTag)
{
	if (!tag)
	{
		return new Error("InitialiseStorylets requires a tag to find storylets.")
	}
	
	tag = tag.toLowerCase().trim();

	this.storylets = {};

	this.mainContentContainer.namedContent.forEach((container) =>
	{
		let tags = this.TagsForContentAtPath(container.name);
		
		if (!tags) return;

		for (var i = 0; i < tags.length; i++)
		{
			tags[i] = tags[i].split(":", 2);

			if (tag == tags[i][0].toLowerCase().trim())
			{		
				let category = (tags[i][1] || "global").toLowerCase().trim();
				
				if (!container.namedContent.get(storylet_contentStitch))
				{
					console.error("Couldn't find a stitch named \"" + storylet_contentStitch + "\" in storylet \"" + container.name + "\".");
					continue;
				}
				
				this.storylets[category] = this.storylets[category] || [];
				this.storylets[category].push(container);
				
				break;
			}
		}
	});

	console.log("Loaded storylets!", this.storylets);
}

function OpenStorylets(category = null)
{
	if (this.storylets)
	{
		let search;
		if (category)
		{
			search = this.storylets[category];
		}
		else if (Object.keys(this.storylets).length)
		{
			search = [];
			Object.keys(this.storylets).forEach(group => search = search.concat(this.storylets[group]));
		}

		if (search && search.length)
		{
			let storylets = [];
			let currentUrgency = 0;
			let currentExclusivity = 0;
			
			search.forEach((storylet) => 
			{
				if (!storylet.namedContent.get(storylet_openStitch) || this.EvaluateContainer(storylet.namedContent.get(storylet_openStitch)))
				{
					
					let exclusivity = this.EvaluateContainer(storylet.namedContent.get(storylet_exclusivityStitch)) || 0;
					let urgency = this.EvaluateContainer(storylet.namedContent.get(storylet_urgencyStitch)) || 0;
					
					if (exclusivity < currentExclusivity) 
					{
						return; 
					}
					else if (exclusivity > currentExclusivity)
					{
						storylets = [];
						currentExclusivity = exclusivity;
						currentUrgency = urgency;
					}
					else if (urgency < currentUrgency)
					{
						return;
					}
					else if (urgency > currentUrgency)
					{
						storylets = [];
						currentUrgency = urgency;
					}
					
					storylets.push(storylet);
				}
			});
			
			if (storylets.length)
			{
				for (var i = storylets.length - 1, j, temp; i > 0; i--)
				{
					j = Math.floor(Math.random()*(i+1));
					temp = storylets[j];
					storylets[j] = storylets[i];
					storylets[i] = temp;  
				}
				
				let stitch = storylets[0].namedContent.get(storylet_contentStitch);
				if (stitch) return stitch.path;
			}
		}
	}

	this.state.callStack.PopThread();
}

inkjs.Story.prototype.ContainerAtPathString = function(path)
{
	let container = this.mainContentContainer;
	
	for (var name of path.split(".")) 
	{
		if (!container.namedContent.has(name)) return null;
		container = container.namedContent.get(name);
	}
	return container;
}

inkjs.Story.prototype.ContentAtPathString = function(path)
{
	return this.ContainerAtPathString(path).content;
}

// returns the last item in a container in the form of {expression}
// where expression is truthy, a variable assignment, a native opertation, 
// a function call, etc. 
// the knot or stitch shouldn't include any text or diverts, only
// functions and a final return value wrapped in curly brackets ({})
inkjs.Story.prototype.EvaluateContainer = function(container)
{
	if (!container) return;

	let content = [].concat(container.content);
	let outputStream = [].concat(this.state._currentFlow.outputStream);

	// check if the container contains an expression, 
	// and if and where we should crop it
	let lastIndex;
	for(let i = container.content.length - 1; i >= 0; i--)
	{
		// commandType 1 (EvalOutput) will remove the value we want
		// from the evaluationStack, so we trim the array to stop that happening
		if(container.content[i].commandType === 1)
		{
			lastIndex = i;
			break;
		}
		lastIndex = -1;
	};
		
	if (lastIndex >= 0)
	{
		// crop the expression now so the result doesn't get removed
		// from the stack in the next step
		container.content.splice(lastIndex);
	}
	
	// then we evaluate it, and return that value from the stack
	let result = this.EvaluateExpression(container);
	
	this.state._currentFlow.outputStream = outputStream;
	container._content = content;

	if (result && result.value) return result.value;
	else return null;
}