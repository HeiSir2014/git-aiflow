const {readFileSync, writeFileSync} = require('fs');
const path = require('path');

const freeModels = JSON.parse(readFileSync(path.join(__dirname, 'openrouter-free-models.json'), 'utf-8')).data.models;

const openrouterFreeModels = freeModels.map(model => {
    return {
        name: model.short_name,
        context_length: model.context_length,
        description: model.description,
        model: model.endpoint.name.split(' | ')[1],
        supported_parameters: model.endpoint.supported_parameters,
    };
});

writeFileSync(path.join(__dirname, 'openrouter-free-models-output.json'), JSON.stringify(openrouterFreeModels, null, 2));