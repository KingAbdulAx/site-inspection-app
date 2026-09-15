const fs = require('fs');

const path = 'data/section03_assets.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

const exists = data.features.some(f => f.properties && f.properties.Struct_No === 'BRG-2601');

if (!exists) {
    const brg = {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [
          8.411, 12.653 // approx coordinate or just dummy for test if accurate not known
        ]
      },
      "properties": {
        "Asset_ID": "BRG-2601",
        "Layer": "Cross Culverts & Bridges",
        "Type": "Bridge",
        "Typology_Class": "Railway Bridge",
        "Side": "Center",
        "Start_PK": 87000,
        "End_PK": 87000,
        "Length_m": 0,
        "Struct_No": "BRG-2601",
        "Dimensions": "Railway Bridge",
        "Drawing_Ref": "DW-03004",
        "Status": "Not Started"
      }
    };
    data.features.push(brg);
    fs.writeFileSync(path, JSON.stringify(data, null, 2), 'utf8');
    console.log("Added BRG-2601");
} else {
    console.log("BRG-2601 already exists");
}
