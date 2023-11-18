const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const baseURL = require('./_urls');

const file = path.join(__dirname, '_files', 'test.html');
let html = Buffer.from(fs.readFileSync(file)).toString();
let HTMLReplacer = {
	'</color>': ' </color>'
};
for (let [k, v] of Object.entries(HTMLReplacer)) {
	html = html.replaceAll(k, v);
}
const $ = cheerio.load(html);


function sortObject(obj) {
	return obj;
	const keys = Object.keys(obj);
	let newObject = {};
	keys.sort();
	for (let i = 0; i < keys.length; i++) {
		let k = keys[i];
		newObject[k] = (obj[k].constructor.name === 'Object') ? sortObject(obj[k]) : obj[k];
	}
	return newObject;
};

async function saveFile(filename, data) {
	return new Promise((resolve) => {
		fs.writeFile(filename, JSON.stringify(sortObject(data), '\t', 4), (err) => {
			if (err) throw err;
			resolve(filename);
		})
	})
}

function findSkills(c, data) {
	const $ = c;
	data['skills'] = { normal: {}, elemental_skill: {}, elemental_burst: {} };
	data['passive'] = [];
	data['constellations'] = [];
	let skillData = [];
	$('.genshin_table.skill_table').each((idx, table) => {
		skillData.push(table);
	})
	const constellazioni = skillData.splice(skillData.length - 6)
	const passive = skillData.splice(skillData.length - 3);
	const talents = skillData;

	for (let p of passive) {
		const keys = ['name', 'effect'];
		let d = {};
		$(p).find('tr').each((idx, tr) => {
			if (idx < keys.length) {
				d[keys[idx]] = $(tr).text().trim().replaceAll('\n', '\t');
				while (d[keys[idx]].indexOf('\t\t') > -1) {
					d[keys[idx]] = d[keys[idx]].replaceAll('\t\t', '\t');
				}
				d[keys[idx]] = d[keys[idx]].replaceAll('\t', ' ');
			}
		})
		data['passive'].push(d);
	}
	data['passive'].push(data['passive'].shift());

	for (let c of constellazioni) {
		const keys = ['name', 'effect'];
		let d = { '#': constellazioni.indexOf(c)+1 };
		$(c).find('tr').each((idx, tr) => {
			if (idx < keys.length) {
				d[keys[idx]] = $(tr).text().trim().replaceAll('\n', '\t');
				while (d[keys[idx]].indexOf('\t\t') > -1) {
					d[keys[idx]] = d[keys[idx]].replaceAll('\t\t', '\t');
				}
				d[keys[idx]] = d[keys[idx]].replaceAll('\t', ' ');
			}
		})
		data['constellations'].push(d);
	}

	for (let n of talents) {
		let talentKeys = Object.keys(data['skills']);
		let keys = ['name', 'effect', 'stats'];
		let t = {}
		$(n).find('tr').each((idx, tr) => {
			switch(idx) {
				case 0:
				case 1:
					t[keys[idx]] = $(tr).text().trim()
					t[keys[idx]] = t[keys[idx]].replaceAll('\n', '\t');
					while (t[keys[idx]].indexOf('\t\t') > -1) {
						t[keys[idx]] = t[keys[idx]].replaceAll('\t\t', '\t');
					}
					t[keys[idx]] = t[keys[idx]].replaceAll('\t', ' ');
					break;
				case 3:
					// Stats
				default:
					break;
			}
		})
		data['skills'][talentKeys[talents.indexOf(n)]] = t
	}

	delete data.passive;
	delete data.constellations;
}

function findStats(c, data) {
	const $ = c;
	data['stats'] = {};
	data['gallery'] = {};
	data['requirements'] = {
		level: {},
		talents: {},
	}
	$('.genshin_table.stat_table thead').first().find('td:not(.hmb)').each((idx, el) => {
		data['stats'][$(el).text()] = []
	})
	let keys = Object.keys(data['stats']);
	$('.genshin_table.stat_table tbody').first().find('tr').each((idx, tr) => {
		$(tr).find('td:not(.hmb)').each((idx, td) => {
			data['stats'][keys[idx]].push($(td).text());
		})
	});

	const getNumber = (n) => {
		return (n.includes('K')) ? parseInt(n) * 1000 : +n
	}

	$('.genshin_table.stat_table').first().find('.itempic_cont').each((idx, div) => {
		data['requirements'].level[$(div).find('img').first().attr('alt')] = getNumber($(div).text());
	});

	$('.genshin_table.asc_table').first().find('.itempic_cont').each((idx, div) => {
		data['requirements'].talents[$(div).find('img').first().attr('alt')] = getNumber($(div).text());
	});

	$('#char_gallery .gallery_cont').each((idx, item) => {
		$(item).find('img').each((idx, img) => {
			data['gallery'][$(img).attr('alt')] = baseURL + $(img).attr('src').replace('_70.webp', '.webp')
		})
	});

// https://genshin.honeyhunterworld.com/img/furina_089_gacha_splash.webp?x46399
// https://genshin.honeyhunterworld.com/img/furina_089_gacha_splash_70.webp?x46399
	findSkills($, data);
	delete data['stats']
	delete data['requirements'];
	delete data['gallery'];
	delete data['talentsMaterials'];
	delete data['ascensionMaterials'];
}

async function parser(c) {
	return new Promise(async (resolve) => {
		const $ = c;
		const data = {
			talentsMaterials: {},
			ascensionMaterials: {},
		};
		$('.genshin_table.main_table').each((idx, el) => {
			$(el).find('tr').each((idx, tr) => {
				switch(idx) {
					case 0:
						data['name'] = $(tr).find('td').last().text();
						break;
					default:
						let k = undefined;
						$(tr).find('td').each((i, v) => {
							if (k === undefined) {
								k = $(v).text().split('(')[0];
							}
							else {
								if (k === 'Rarity') {
									data[k] = $(v).find('img').length + ' stars'
								}
								else if (!k.includes('Materials') && !k.includes('Seuyu')) {
									data[k] = $(v).text().trim();
								}
								else {
									if (k.includes('Character')) {
										$(v).find('img').each((idx, i) => {
											data.ascensionMaterials[$(i).attr('alt')] = baseURL + $(i).attr('src').replace('_35.webp', '.webp')
										})
									}
									else if (k.includes('Skill')) {
										$(v).find('img').each((idx, i) => {
											data.talentsMaterials[$(i).attr('alt')] = baseURL + $(i).attr('src').replace('_35.webp', '.webp')
										})
									}
								}
							}
						})
						break;
				}
			})
		});
		findStats($, data);
		// console.log(sortObject(data))
		resolve(data)
	})
}

console.clear();
parser($)
.then((d) => {
	return saveFile('temp-furina.json', d);
})
.then((f) => {
	console.log('File salvato con successo!');
})
.catch((err) => {
	console.log(err)
});
