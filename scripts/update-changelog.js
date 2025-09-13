#!/usr/bin/env node

/**
 * Script to manually update CHANGELOG.md
 * Usage: node scripts/update-changelog.js [version]
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const VERSION = process.argv[2] || JSON.parse(readFileSync('package.json', 'utf8')).version;
const DATE = new Date().toISOString().split('T')[0];

console.log(`Updating CHANGELOG.md for version ${VERSION}...`);

// Get commits since last version
const getCommits = () => {
  try {
    const commits = execSync('git log --oneline --grep="feat\\|fix\\|refactor\\|docs\\|style\\|perf\\|test\\|chore" --since="2024-01-01" --pretty=format:"%h %s"', { encoding: 'utf8' });
    return commits.trim().split('\n').slice(0, 20);
  } catch (error) {
    console.warn('Could not get git commits:', error.message);
    return [];
  }
};

// Categorize commits
const categorizeCommits = (commits) => {
  const categories = {
    added: [],
    changed: [],
    fixed: [],
    docs: []
  };

  commits.forEach(commit => {
    if (!commit.trim()) return;
    
    const message = commit.substring(commit.indexOf(' ') + 1);
    
    if (message.startsWith('feat')) {
      categories.added.push(`- ${message}`);
    } else if (message.match(/^(refactor|perf|style)/)) {
      categories.changed.push(`- ${message}`);
    } else if (message.startsWith('fix')) {
      categories.fixed.push(`- ${message}`);
    } else if (message.startsWith('docs')) {
      categories.docs.push(`- ${message}`);
    }
  });

  return categories;
};

// Generate changelog entry
const generateChangelogEntry = (version, date, categories) => {
  let entry = `## [${version}] - ${date}\n\n`;

  if (categories.added.length > 0) {
    entry += '### Added\n';
    entry += categories.added.join('\n') + '\n\n';
  }

  if (categories.changed.length > 0) {
    entry += '### Changed\n';
    entry += categories.changed.join('\n') + '\n\n';
  }

  if (categories.fixed.length > 0) {
    entry += '### Fixed\n';
    entry += categories.fixed.join('\n') + '\n\n';
  }

  if (categories.docs.length > 0) {
    entry += '### Documentation\n';
    entry += categories.docs.join('\n') + '\n\n';
  }

  return entry;
};

// Update CHANGELOG.md
const updateChangelog = (version, date) => {
  const changelogPath = 'CHANGELOG.md';
  let changelog = readFileSync(changelogPath, 'utf8');
  
  const commits = getCommits();
  const categories = categorizeCommits(commits);
  const entry = generateChangelogEntry(version, date, categories);
  
  // Insert after [Unreleased] section
  const unreleasedIndex = changelog.indexOf('## [Unreleased]');
  if (unreleasedIndex === -1) {
    console.error('Could not find [Unreleased] section in CHANGELOG.md');
    process.exit(1);
  }
  
  const nextSectionIndex = changelog.indexOf('\n## [', unreleasedIndex + 1);
  const insertPosition = nextSectionIndex === -1 ? changelog.length : nextSectionIndex;
  
  const before = changelog.substring(0, insertPosition);
  const after = changelog.substring(insertPosition);
  
  const updatedChangelog = before + '\n' + entry + after;
  
  writeFileSync(changelogPath, updatedChangelog);
  console.log(`✅ CHANGELOG.md updated for version ${version}`);
};

// Main execution
try {
  updateChangelog(VERSION, DATE);
  console.log('🎉 Changelog update completed successfully!');
} catch (error) {
  console.error('❌ Error updating changelog:', error.message);
  process.exit(1);
}
