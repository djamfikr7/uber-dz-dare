const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

const token = process.argv[2] || process.env.GITHUB_TOKEN;

if (!token) {
  console.error('\n🚨 ERROR: GitHub Personal Access Token (PAT) is required!');
  console.log('Usage: node git_sync.js <YOUR_GITHUB_TOKEN>\n');
  process.exit(1);
}

const email = 'djamfikr7@gmail.com';
const username = 'djamfikr7';
const repoName = 'uber-dz-dare';

console.log(`================================================================`);
console.log(`🐙 GIT AUTOMATION SYNC TOOL WITH AUTO-REPO CREATION`);
console.log(`================================================================`);
console.log(`[GIT] Email target: ${email}`);
console.log(`[GIT] Target repo: https://github.com/${username}/${repoName}`);

function createGithubRepository(patToken) {
  return new Promise((resolve, reject) => {
    console.log('[API] Querying/Creating GitHub repository via REST API...');
    
    const bodyData = JSON.stringify({
      name: repoName,
      description: 'Algeria Enterprise Ride-Sharing Ecosystem with DARE engine parallel validation and Obsidian graphs.',
      private: false
    });

    const options = {
      hostname: 'api.github.com',
      port: 443,
      path: '/user/repos',
      method: 'POST',
      headers: {
        'Authorization': `token ${patToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'DARE-Client-Node',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyData)
      }
    };

    const req = https.request(options, (res) => {
      let responseBody = '';
      res.on('data', chunk => { responseBody += chunk; });
      res.on('end', () => {
        if (res.statusCode === 201) {
          console.log(`[API] Successfully created new repository "${repoName}" on GitHub!`);
          resolve();
        } else if (res.statusCode === 422) {
          console.log(`[API] Repository "${repoName}" already exists on GitHub account.`);
          resolve();
        } else {
          reject(new Error(`API Error ${res.statusCode}: ${responseBody}`));
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.write(bodyData);
    req.end();
  });
}

async function run() {
  try {
    // 1. Create repo on GitHub if missing
    await createGithubRepository(token);

    // 2. Configure local credentials
    console.log('[GIT] Configuring user details...');
    execSync(`git config user.email "${email}"`, { stdio: 'inherit' });
    execSync(`git config user.name "${username}"`, { stdio: 'inherit' });

    // 3. Create .gitignore if missing
    const gitignorePath = path.join(__dirname, '.gitignore');
    if (!fs.existsSync(gitignorePath)) {
      const gitignoreContent = `
node_modules/
.DS_Store
.env
.env.*
.idea/
.vscode/
.dart_tool/
.packages
.flutter-plugins
.flutter-plugins-dependencies
build/
*.g.dart
`;
      fs.writeFileSync(gitignorePath, gitignoreContent);
      console.log('[GIT] Created default .gitignore file');
    }

    // 4. Add files and commit
    console.log('[GIT] Staging changes...');
    execSync('git add .', { stdio: 'inherit' });
    
    try {
      console.log('[GIT] Committing changes...');
      execSync('git commit -m "feat: DARE platform initial release. Multi-threaded worker simulation, Obsidian graph panel, and CI Actions pipeline."', { stdio: 'inherit' });
    } catch (commitErr) {
      console.log('[GIT] No changes to commit or already committed.');
    }

    // 5. Set branch to main
    console.log('[GIT] Adjusting branch to main...');
    execSync('git branch -M main', { stdio: 'inherit' });

    // 6. Set remote origin url authenticated with the token
    console.log('[GIT] Setting remote URL with authentication...');
    const remoteUrl = `https://${username}:${token}@github.com/${username}/${repoName}.git`;
    
    try {
      execSync('git remote remove origin', { stdio: 'ignore' });
    } catch (e) {}

    execSync(`git remote add origin ${remoteUrl}`, { stdio: 'inherit' });

    // 7. Push to repository
    console.log('[GIT] Pushing repository files to GitHub...');
    execSync('git push -u origin main --force', { stdio: 'inherit' });
    console.log('\n🎉 SUCCESS: Codebase pushed to GitHub successfully!');
    
  } catch (error) {
    console.error('\n🚨 GIT AUTOMATION ENCOUNTERED AN ERROR:');
    console.error(error.message);
    process.exit(1);
  }
}

run();
