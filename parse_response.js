const data = require('./diag_deep_response.json');
console.log('Project level customFieldValues:', JSON.stringify(data.customFieldValues, null, 2));
if (data.customFieldValues) {
    data.customFieldValues.forEach(f => {
        console.log(`Field: id=${f.customFieldId}, value=${f.value}, customField=${JSON.stringify(f.customField)}`);
    });
}
