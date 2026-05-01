const fs = require('fs');

async function processImage() {
    // We will use Jimp to make it transparent
    // First, let's install jimp
    const { execSync } = require('child_process');
    try {
        execSync('npm install jimp', { stdio: 'ignore' });
    } catch (e) {
        console.log("Failed to install jimp");
        return;
    }

    const Jimp = require('jimp');
    const imagePath = 'runner_char.png';
    const outPath = 'runner_char_transparent.png';

    try {
        const image = await Jimp.read(imagePath);
        // Get the top-left pixel color to use as the background color to remove
        const bgColor = image.getPixelColor(0, 0);
        
        // Scan all pixels
        image.scan(0, 0, image.bitmap.width, image.bitmap.height, function(x, y, idx) {
            const currentColor = image.getPixelColor(x, y);
            
            // If color is very close to bgColor, make it transparent
            // Jimp colors are RGBA
            const r1 = (bgColor >> 24) & 255;
            const g1 = (bgColor >> 16) & 255;
            const b1 = (bgColor >> 8) & 255;

            const r2 = this.bitmap.data[idx + 0];
            const g2 = this.bitmap.data[idx + 1];
            const b2 = this.bitmap.data[idx + 2];

            const diff = Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2);
            
            if (diff < 40) { // Tolerance for JPEG artifacts
                this.bitmap.data[idx + 3] = 0; // Alpha = 0
            }
        });

        await image.writeAsync(outPath);
        console.log("Success");
    } catch (err) {
        console.error(err);
    }
}

processImage();
