
import fs from "fs";
/**
 * Remove old files, copy front-end ones.
 */

// @ts-ignore


try {
    if (fs.existsSync('./dist/')) {
        // Remove current build
        fs.rmdirSync('./dist/', { recursive: true });
    }

    // Copy front-end files
    fs.cpSync('./src/public', './dist/public');
    fs.cpSync('./src/views', './dist/views');
} catch (err) {
    console.log(err);
}