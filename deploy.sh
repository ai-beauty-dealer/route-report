#!/usr/bin/env sh
set -e
npm run build
cd dist
git init
git add -A
git commit -m 'deploy timezone fix'
git push -f git@github.com:ai-beauty-dealer/route-report.git main:gh-pages
cd -
