/* eslint-disable max-len */
// папка проекта
const distFolder = 'dist';
// сжатый проект
const minFolder = 'min';
// папка исходников
const srcFolder = 'src';
// файловая система
const fs = require('fs');

const {
	src, dest, parallel, series, lastRun, watch,
} = require('gulp');

// пути
const path = {
	// проект
	build: {
		html: `${distFolder}/`,
		css: `${distFolder}/`,
		js: `${distFolder}/`,
		img: `${distFolder}/img/`,
		fonts: `${distFolder}/fonts/`,
	},
	// минифицированная версия
	minBuild: {
		html: `${minFolder}/`,
		css: `${minFolder}/`,
		js: `${minFolder}/`,
		img: `${minFolder}/img/`,
		fonts: `${minFolder}/fonts/`,
	},
	// исходники
	src: {
		html: `${srcFolder}/index.html`,
		css: `${srcFolder}/css/index.css`,
		js: `${srcFolder}/js/index.js`,
		img: `${srcFolder}/**/`,
		fonts: `${srcFolder}/fonts/`,
	},
	// отслеживание
	watch: {
		html: `${srcFolder}/**/*.html`,
		css: `${srcFolder}/**/*.scss`,
		js: `${srcFolder}/**/*.js`,
		img: `${srcFolder}/**/`,
	},
	// очистка
	clean: `./${distFolder}/`,
};

// модули и т.д.
// HTML
const htmlInclude = require('gulp-html-tag-include'); // объединение html
const webpHtml = require('gulp-webp-html'); // webp в html
const htmlmin = require('gulp-htmlmin'); // min html
// CSS
const postcss = require('gulp-postcss'); // postcss
const importcss = require('postcss-import'); // import css
const media = require('postcss-media-minmax'); // @media (width >= 320px) в @media (min-width: 320px)
const autoprefixer = require('autoprefixer'); // autoprefixer
const mqpacker = require('css-mqpacker'); // группирует @media
const prettier = require('gulp-prettier'); // prettier
const cssnano = require('cssnano'); // сжатие css
// JS
const fileInclude = require('gulp-file-include'); // подключение файлов (работает для всех)
const babel = require('gulp-babel'); // babel
const terser = require('gulp-terser'); // сжатие js
// IMG
const webp = require('gulp-webp'); // конвертация в webp
// FONTS
const ttf2woff2 = require('gulp-ttf2woff2'); // ttf2woff2
const fonter = require('gulp-fonter'); // otf2ttf
// работа с файлами
const del = require('del'); // удалить папки/файлы
const rename = require('gulp-rename'); // переименовать файл
const flatten = require('gulp-flatten'); // работа с путями к файлу
const browserSync = require('browser-sync').create(); // браузер

// HTML

const html = () => src(path.src.html)
	.pipe(htmlInclude())
	.pipe(dest(path.build.html))
	.pipe(browserSync.stream());

// CSS

const css = () => src(path.src.css)
	.pipe(
		postcss([
			importcss(),
			media(),
			mqpacker({
				sort: true,
			}),
			autoprefixer(),
		]),
	)
	.pipe(prettier())
	.pipe(dest(path.build.css))
	.pipe(browserSync.stream());

// JS

const js = () => src(path.src.js)
	.pipe(fileInclude())
	.pipe(dest(path.build.js))

	.pipe(babel({
		presets: ['@babel/preset-env'],
	}))
	.pipe(
		rename({
			extname: '.es5.js',
		}),
	)
	.pipe(dest(path.build.js))
	.pipe(browserSync.stream());

// min HTML CSS JS

const minHTML = () => src([`${path.build.html}index.html`]) // сжимаем css
	.pipe(htmlmin({
		removeComments: true,
		collapseWhitespace: true,
	}))
	.pipe(dest(path.minBuild.html));

const minCSS = () => src([`${path.build.css}index.css`]) // сжимаем css
	.pipe(postcss([cssnano()]))
	.pipe(
		rename({
			extname: '.min.css',
		}),
	)
	.pipe(dest(path.minBuild.css));

const minJS = () => src([`${path.build.js}index.js`, `${path.build.js}index.es5.js`])
	.pipe(src([`${path.build.js}*.js`]))
	.pipe(terser())
	.pipe(
		rename({
			extname: '.min.js',
		}),
	)
	.pipe(dest(path.minBuild.js));

const copy = () => src([
	`${distFolder}/fonts/**/*`,
	`${distFolder}/img/**/*`,
],
{
	base: distFolder,
})
	.pipe(dest(minFolder))
	.pipe(browserSync.stream());

// img

const img = (cb) => {
	fs.readdirSync(`${srcFolder}/blocks/`).forEach((block) => {
		src(`src/blocks/${block}/img/*.{jpg,png,}`)
			.pipe(
				webp({
					quality: 75, // Установите коэффициент качества между 0 и 100
					method: 4, // Укажите метод сжатия, который будет использоваться между 0(самым быстрым) и 6(самым медленным).
				}),
			)
			.pipe(dest(`${srcFolder}/blocks/${block}/img`))

			.pipe(src(`${path.src.img}*.webp`))
			.pipe(flatten()) // удалить относительный путь к картинке
			.pipe(dest(path.build.img));
	});
	cb();
};

// fonts

const ttf = () => src(`${path.src.fonts}*.ttf`)
	.pipe(ttf2woff2())
	.pipe(dest(path.src.fonts))

	.pipe(src(`${path.src.fonts}*.woff2`))
	.pipe(dest(path.build.fonts));

const otf = () => src(`${path.src.fonts}*.otf`)
	.pipe(fonter({
		formats: ['ttf'],
	}))
	.pipe(dest(path.src.fonts))

	.pipe(src(`${path.src.fonts}*.woff2`))
	.pipe(dest(path.build.fonts));

// запись шрифтов в fonts.css
// файл должен быть изначально пустой
// в конце требуется откорректировать названиие шрифтов и их начертание

const fontsStyle = (cb) => {
	const fileContent = fs.readFileSync(`${srcFolder}/css/global/fonts.css`).toString(); // получаем содержимое файла
	// проверяем пустой ли файл
	if (fileContent === '') {
		fs.writeFileSync(`${srcFolder}/css/global/fonts.css`, '/* Fonts */\r\n\r\n'); // записываем заглавный комментарий
		let cFontName = ''; // копия названия файла (шрифта)
		// читаем содержимое папки
		fs.readdirSync(path.build.fonts).forEach((item) => {
			const fontName = item.split('.')[0]; // получаем имя файла (шрифта)
			// сравниваем с копияей, чтобы исключить повторы
			if (cFontName !== fontName) {
				fs.appendFileSync(`${srcFolder}/css/global/fonts.css`, // завписываем структуру подключения в файл
					`@font-face {
	font-family: '${fontName}';
	font-display: swap;
	src: url('../fonts/${fontName}.woff2') format('woff2');
	font-style: normal;
	font-weight: 400;
}\r\n\r\n`);
			}
			cFontName = fontName;
		});
	}
	cb();
};

// clean

const clean = () => del(path.clean);

// удалить jpg, png, ttf

const cleanSRC = () => del(['src/blocks/**/img/*.{jpg,png}', `${path.src.fonts}*.{ttf,otf,}`]);

// clean

const cleanMin = () => del(minFolder);

// syns

const browser = () => {
	browserSync.init({
		server: {
			baseDir: `./${distFolder}/`,
		},
		port: 3000,
		notify: false,
	});
};

// watch

const watchFiles = () => {
	watch(path.watch.html, html);
	watch(path.watch.css, css);
	watch(path.watch.js, js);
	watch(`${path.src.img}*.{jpg,png,}`, img);
};

// cобрать проект
const build = series(clean, parallel(js, css, html, img, series(parallel(ttf, otf), fontsStyle)));
// запустить watcher и браузер
const watchBrowser = parallel(watchFiles, browser);

exports.html = html;
exports.css = css;
exports.js = js;

exports.img = img;
exports.fonts = parallel(ttf, otf);
exports.fontsStyle = fontsStyle;

exports.clean = clean;
exports.cleanSRC = cleanSRC;
exports.cleanMin = cleanMin;

exports.build = build;
exports.browser = browser;
exports.watchFiles = watchFiles;

exports.min = series(cleanMin, parallel(minHTML, minCSS, minJS, copy));

exports.default = series(build, watchBrowser);
