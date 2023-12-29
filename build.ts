
import fs from "fs";
/**
 * Remove old files, copy front-end ones.
 */

// @ts-ignore


try {
    // Remove current build
    fs.rmSync('./dist/');
    // Copy front-end files
    fs.cpSync('./src/public', './dist/public');
    fs.cpSync('./src/views', './dist/views');
} catch (err) {
    console.log(err);
}