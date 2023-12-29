/**
 * Remove old files, copy front-end ones.
 */

// @ts-ignore


try {
    // Remove current build
    fs.removeSync('./dist/');
    // Copy front-end files
    fs.copySync('./src/public', './dist/public');
    fs.copySync('./src/views', './dist/views');
} catch (err) {
    console.log(err);
}