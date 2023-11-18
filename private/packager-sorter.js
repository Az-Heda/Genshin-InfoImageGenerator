const fs = require('fs');


function sortObject(obj) {
	const keys = Object.keys(obj);
	let newObject = {};
	keys.sort();
	for (let i = 0; i < keys.length; i++) {
		let k = keys[i];
		newObject[k] = (obj[k].constructor.name === 'Object') ? sortObject(obj[k]) : obj[k];
	}
	return newObject;
};

let package = JSON.parse(Buffer.from(fs.readFileSync('package.json')).toString())
let sorted = sortObject(package);
fs.writeFileSync('package.json', JSON.stringify(sorted, '\t', 4));
