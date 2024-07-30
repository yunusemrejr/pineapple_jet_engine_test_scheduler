async function predefinedHourlyLimitsCheckObj(hour, resources) {
    const limitValues = await fetchPredefinedHourlyLimits();

    const isHourWithinLimits = limitValues.some((limit) => {
        const hourMatch = limit.triggerHoursList.includes(hour);
        console.log(`Checking hour: ${hour}, trigger hours: ${limit.triggerHoursList}, hourMatch: ${hourMatch}`);

        if (!hourMatch) {
            // If the hour is not within the trigger hours list, return true (no limits applied to this hour)
            console.log(`Hour ${hour} is not within the trigger hours, allowing it.`);
            return true;
        }

        // If the hour is within the trigger hours, check the resources
        const resourceMatch = resources.every((resource) => {
            const resourceLimit = limit.resources.find((limitResource) => limitResource.resourceId === resource.resourceId);
            const withinLimit = resourceLimit && resource.value <= resourceLimit.limitValue;
            console.log(`Checking resource: ${resource.resourceId}, value: ${resource.value}, limit: ${resourceLimit ? resourceLimit.limitValue : 'N/A'}, withinLimit: ${withinLimit}`);
            return withinLimit;
        });

        return resourceMatch; // Return resource match result if hour is within trigger hours
    });

    console.log(`predefinedHourlyLimitsCheckObj - hour: ${hour}, resources:`, resources);
    console.log(`predefinedHourlyLimitsCheckObj - isHourWithinLimits: ${isHourWithinLimits}`);
    return isHourWithinLimits;
}



 // Function to extract resource data from the DOM
function getResourcesFromDOM() {
    const resources = [];
    const usageElements = document.querySelectorAll('.resource-usage');
    usageElements.forEach((usageElement) => {
        const resourceId = usageElement.getAttribute('data-resource-type-id');
        const selectedOption = usageElement.options[usageElement.selectedIndex];
        if (selectedOption) {
            const value = selectedOption.text;
            resources.push({
                resourceId: parseInt(resourceId, 10),
                value: parseInt(value, 10)
            });
        }
    });
    console.log('getResourcesFromDOM - resources:', resources);
    return resources;
}
// Function to add event listeners to select elements
function addEventListenersToSelectElements() {
    const selectElements = document.querySelectorAll('.resource-usage');
    selectElements.forEach((selectElement) => {
        selectElement.addEventListener('change', handleResourceChange);
    });
    console.log('addEventListenersToSelectElements - Event listeners added to select elements');
}

async function handleResourceChange() {
    const resources = getResourcesFromDOM();
    const startHourElement = document.querySelector('#startHour');
    const durationElement = document.querySelector('#duration');

    if (parseInt(startHourElement.value) !== 0 && parseInt(durationElement.value) !== 0) {
        const hours = [];
        let startHour = parseInt(startHourElement.value);
        const duration = parseInt(durationElement.value);

        for (let i = 0; i < duration; i++) {
            hours.push(startHour + i);
        }

        try {
            const results = await Promise.all(hours.map(hour => predefinedHourlyLimitsCheckObj(hour, resources)));
            const allWithinLimits = results.every(result => result);

            console.log('handleResourceChange - results:', results);
            console.log('handleResourceChange - allWithinLimits:', allWithinLimits);

            document.querySelector('#detailedSubmitButtton').style.display = allWithinLimits ? 'block' : 'none';
        } catch (error) {
            console.error('Error:', error);
        }
    } else {
        notifyWrapper('Please select start hour and duration');
    }
}

document.addEventListener("DOMContentLoaded", () => {
    document.querySelector('#addNewTest').addEventListener('click', () => {
        setTimeout(() => {
            addEventListenersToSelectElements();
            document.querySelector('#detailedSubmitButtton').style.display = 'none';
        }, 1000);
    });
    console.log('DOMContentLoaded event listener added');
});