# Design the Future of Spreadsheets and Notebooks

COMP4981 Final Year Project, HKUST. Built on [MLscript](https://github.com/hkust-taco/mlscript).

Project notes: [COMP4981 FYP on Notion](https://app.notion.com/p/wanyeung/COMP4981-FYP-39b5d246eb7780a18015fe4e3b402a7a?source=copy_link)

## Features

1. Version 0.0.0, minimum loop: the core is written in MLscript and compiled to JavaScript. It decides whether a notebook value is a single value, a list or a table. Next: edit a table cell, patch the cell's source, re-run.

## Installation Instructions

1. Install Node.js 22 (the version this was tested on).
2. Clone this repository.
3. Run `npm test`. It compiles `src/main/mls` into `build/main` and runs the tests. There is nothing else to install.

## Usage

Demo video: https://youtu.be/dAxtzRr72uA

## Credits & Contact

- Wan Yeung: Overview & System Design (mwyeungad@connect.ust.hk, lowanyeung@gmail.com)
- Owen Chung: Literature Survey (lchengas@connect.ust.hk)
- Peter Yeontaek Oh: Feasibility Study, Streamlit (yohae@connect.ust.hk)
- Eunseo Lee: Planning & UI Design (eleean@connect.ust.hk)
