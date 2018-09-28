#!/bin/bash
THEME_DIR="./themes/hugo-theme-learn"

if [[ ! -d $THEME_DIR ]]; then
  echo "Cloning theme"
  git clone https://github.com/matcornic/hugo-theme-learn $THEME_DIR
else
  echo "Pulling theme"
  cd $THEME_DIR
  git pull
  cd ../..
fi

hugo
