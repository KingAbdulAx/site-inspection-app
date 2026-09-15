const fs = require('fs');
const path = require('path');

const EMOJI_REGEX = /([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g;

// Safe list of characters to NOT replace (e.g. — \u2014, · \u00B7, ▾ \u25BE, ± \u00B1, ⇄ \u21C4, \u1F4D0, etc)
// Actually we only want to remove standard emojis. 
// Emojis seen: , , , , , , , , , , 
const targetEmojis = ['', '', '', '', '', '', '', '', '', '', '', ''];
function removeEmojis(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        if (file === 'node_modules' || file === '.git' || file === 'data' || file.endsWith('.json') || file.endsWith('.md')) continue;
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            removeEmojis(filePath);
        } else if (file.endsWith('.html') || file.endsWith('.js') || file.endsWith('.css')) {
            let content = fs.readFileSync(filePath, 'utf8');
            let modified = false;
            targetEmojis.forEach(emoji => {
                if (content.includes(emoji)) {
                    // console.log(`Found ${emoji} in ${filePath}`);
                    content = content.replaceAll(emoji + ' ', ''); // with space
                    content = content.replaceAll(emoji, '');
                    modified = true;
                }
            });
            // also remove FE0F variant of map
            content = content.replace(/\uD83D\uDDFA\uFE0F/g, ''); // 

            if (modified) {
                fs.writeFileSync(filePath, content, 'utf8');
                console.log(`Removed emojis from ${filePath}`);
            }
        }
    }
}
removeEmojis(__dirname);
