import fs from 'fs/promises';
import path from 'path';

// Go two levels up from /annotator-ui/scripts to get to the root 'RP experiment'
const sourceDataDir = path.resolve(process.cwd(), '../');
const publicDir = path.resolve(process.cwd(), './public');
const dataDir = path.resolve(publicDir, 'data');
const manifestPath = path.resolve(publicDir, 'manifest.json');

async function copyDir(src, dest) {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            // Skip directories we don't care about like .git, node_modules, etc.
            if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'annotator-ui') {
                continue;
            }
            await copyDir(srcPath, destPath);
        } else {
            await fs.copyFile(srcPath, destPath);
        }
    }
}

async function createManifest() {
    console.log("Starting data preparation...");

    // 1. Copy data directories to the public folder
    try {
        console.log(`Copying 'Truthful' and 'Deceitful' directories to ${dataDir}...`);
        await fs.rm(dataDir, { recursive: true, force: true }); // Clear old data
        await fs.mkdir(dataDir, { recursive: true });
        await copyDir(path.join(sourceDataDir, 'Truthful'), path.join(dataDir, 'Truthful'));
        await copyDir(path.join(sourceDataDir, 'Deceitful'), path.join(dataDir, 'Deceitful'));
        console.log("Data copied successfully.");
    } catch (error) {
        console.error("Error copying data directories:", error);
        return;
    }

    // 2. Scan the new data directory and build the manifest
    const manifest = [];
    const baseDirs = ['Truthful', 'Deceitful'];

    console.log("Scanning directories to create manifest...");
    for (const baseDir of baseDirs) {
        const fullBasePath = path.join(dataDir, baseDir);
        try {
            const subDirs = await fs.readdir(fullBasePath); // 'adhering', 'non-adhering'
            for (const subDir of subDirs) {
                const logDirsPath = path.join(fullBasePath, subDir);
                const logDirs = await fs.readdir(logDirsPath); // 'log1', 'log2', etc.
                
                for (const logDir of logDirs) {
                    const singleLogPath = path.join(logDirsPath, logDir);
                    const files = await fs.readdir(singleLogPath);

                    const logFile = files.find(f => f.startsWith('logs') && f.endsWith('.json'));
                    const finalSummaryFile = files.find(f => f === 'final_summary.json');

                    if (logFile) {
                        const trueCategory = baseDir.toLowerCase();
                        const adherenceCategory = subDir.toLowerCase().replace('adhering','adhering'); // normalize
                        
                        manifest.push({
                            id: `${baseDir}-${subDir}-${logDir}`,
                            logPath: `/data/${baseDir}/${subDir}/${logDir}/${logFile}`,
                            summaryPath: finalSummaryFile ? `/data/${baseDir}/${subDir}/${logDir}/${finalSummaryFile}` : null,
                            groundTruth: {
                                deception: trueCategory,
                                adherence: adherenceCategory,
                            }
                        });
                    }
                }
            }
        } catch (error) {
            console.error(`Could not process directory ${fullBasePath}:`, error)
        }
    }

    // 3. Write the manifest file
    try {
        await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
        console.log(`Manifest created successfully at ${manifestPath}`);
        console.log(`Found ${manifest.length} log entries.`);
    } catch (error) {
        console.error("Error writing manifest file:", error);
    }
}

createManifest(); 