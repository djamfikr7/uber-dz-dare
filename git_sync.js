const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

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
console.log(`🐙 GIT AUTOMATION SYNC TOOL`);
console.log(`================================================================`);
console.log(`[GIT] Email target: ${email}`);
console.log(`[GIT] Target repo: https://github.com/${username}/${repoName}`);

try {
  // 1. Configure local credentials
  console.log('[GIT] Configuring user details...');
  execSync(`git config user.email "${email}"`, { stdio: 'inherit' });
  execSync(`git config user.name "${username}"`, { stdio: 'inherit' });

  // 2. Create .gitignore if it doesn't exist to prevent pushing unnecessary modules
  const gitignorePath = path.join(__dirname, '.gitignore');
  if (!fs.existsSync(gitignorePath)) {
    const gitignoreContent = `
node_modules/
.DS_Store
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

  // 3. Add files and commit
  console.log('[GIT] Staging changes...');
  execSync('git add .', { stdio: 'inherit' });
  
  try {
    console.log('[GIT] Committing changes...');
    execSync('git commit -m "feat: DARE platform initial release. Multi-threaded worker simulation, Obsidian graph panel, and CI Actions pipeline."', { stdio: 'inherit' });
  } catch (commitErr) {
    console.log('[GIT] No changes to commit or already committed.');
  }

  // 4. Set branch to main
  console.log('[GIT] Adjusting branch to main...');
  execSync('git branch -M main', { stdio: 'inherit' });

  // 5. Set remote origin url authenticated with the token
  console.log('[GIT] Setting remote URL with authentication...');
  const remoteUrl = `https://${username}:${token}@github.com/${username}/${repoName}.git`;
  
  try {
    execSync('git remote remove origin', { stdio: 'ignore' });
  } catch (e) {}

  execSync(`git remote add origin ${remoteUrl}`, { stdio: 'inherit' });

  // 6. Push to repository
  console.log('[GIT] Attempting to push repository files to GitHub...');
  console.log(`💡 Note: Please make sure you have created the empty repository "${repoName}" on your GitHub account!`);
  
  execSync('git push -u origin main --force', { stdio: 'inherit' });
  console.log('\n🎉 SUCCESS: Codebase pushed to GitHub successfully!');
  
} catch (error) {
  console.error('\n🚨 GIT AUTOMATION ENCOUNTERED AN ERROR:');
  console.error(error.message);
  console.log('\nPlease verify that:');
  console.log('1. Your GitHub token is valid and has "repo" permissions.');
  console.log(`2. You have created an empty repository named "${repoName}" on your GitHub account (https://github.com/new).`);
  process.exit(1);
}
