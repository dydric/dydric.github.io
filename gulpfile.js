/*eslint no-console: ["error", { allow: ["log", "warn", "error"] }] */
/*global require, process */

var gulp = require('gulp'),
  babel = require('gulp-babel'),
  cleanCSS = require('gulp-clean-css'),
  concat = require('gulp-concat'),
  fs = require('fs'),
  notify = require('gulp-notify'),
  plumber = require('gulp-plumber'),
  postcss = require('gulp-postcss'),
  purgecss = require('@fullhuman/postcss-purgecss'),
  rename = require('gulp-rename'),
  run = require('gulp-run-command').default,
  sass = require('gulp-sass'),
  sheetsy = require('sheetsy'),
  tailwindcss = require('tailwindcss'),
  twitter = require('twitter'),
  uglify = require('gulp-uglify');

// Resources paths
var paths = {
  sass: {
    source: './resources/sass/style.scss',
    dest: 'assets/css/'
  },
  javascript: {
    source: './resources/js/**/*.js',
    dest: 'assets/javascript/'
  }
};

// Errors function
var onError = function (err) {
  notify.onError({
    title: 'Gulp Error - Compile Failed',
    message: 'Error: <%= error.message %>'
  })(err);

  this.emit('end');
};

class TailwindExtractor {
  static extract(content) {
    return content.match(/[A-z0-9-:/]+/g) || [];
  }
}

require('dotenv').config();

// Create the tailwind.config.js file.
gulp.task('tailwind:init', run('./node_modules/.bin/tailwind init tailwind.config.js'));


gulp.task('data:workouts', (cb) => {
  const { urlToKey, getWorkbook, getSheet } = sheetsy;
  const key = urlToKey(process.env.WORKOUTS_URL);

  getWorkbook(key).then(workbook => {
    const workbookID = workbook.sheets[0].id;

    getSheet(key, workbookID).then(sheet => {

      var activities = sheet.rows.map((activity) => {
        return {
          type: activity[2],
          movingtime: activity[4],
          distance: activity[6],
          heartrate: activity[8],
          activecalories: activity[7]
        };
      });

      var jsonWorkouts = JSON.stringify(activities.slice(0, 49));

      fs.writeFile('site/data/import/workouts.json', jsonWorkouts, function(err) {
        if(err) {
          console.warn(err);
        } else {
          console.log('Workouts data saved.');
          cb();
        }
      });
    });
  });
});

// Health

gulp.task('data:health', (cb) => {
  const { urlToKey, getWorkbook, getSheet } = sheetsy;
  const key = urlToKey(process.env.HEALTH_URL);

  getWorkbook(key).then(workbook => {
    const workbookID = workbook.sheets[0].id;

    getSheet(key, workbookID).then(sheet => {

      var dailyHealth = sheet.rows.map((day) => {
        return {
          energy: day[1],
          resting_energy: day[2],
          resting: day[3],
          hrv: day[4],
          steps: day[5]
        };
      });

      var jsonHealth = JSON.stringify(dailyHealth.slice(0, 29));

      fs.writeFile('site/data/import/health.json', jsonHealth, function(err) {
        if(err) {
          console.warn(err);
        } else {
          console.log('Daily Health data saved.');
          cb();
        }
      });
    });
  });
});

// Spotify

gulp.task('data:spotify', (cb) => {
  const { urlToKey, getWorkbook, getSheet } = sheetsy;
  const key = urlToKey(process.env.SPOTIFY_URL);

  getWorkbook(key).then(workbook => {
    const workbookID = workbook.sheets[0].id;

    getSheet(key, workbookID).then(sheet => {
      // console.log(sheet);
      var playlist = sheet.rows.reverse().map((track) => {
        return {
          name: track[0],
          artist: track[1],
          album: track[2],
          cover: track[3],
          url: track[4]
        };
      });

      var jsonTracks = JSON.stringify(playlist.slice(0, 49));

      fs.writeFile('site/data/import/tracks.json', jsonTracks, function(err) {
        if(err) {
          console.warn(err);
        } else {
          console.log('Spotify Tracks data saved.');
          cb();
        }
      });
    });
  });
});

const client = new twitter({
  consumer_key:        process.env.TWITTER_CONSUMER_KEY,
  consumer_secret:     process.env.TWITTER_CONSUMER_SECRET,
  access_token_key:    process.env.TWITTER_ACCESS_TOKEN_KEY,
  access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET
});

// Twitter
gulp.task('data:twitter', (cb) => {

  let params = {screen_name: 'dydric', count: 6};

  client.get('statuses/user_timeline', params, function (error, tweets) {
    if (!error) {

      tweets = tweets.map((tweet) => {
        return {
          text:    tweet.text,
          url:     'https://twitter.com/dydric/status/' + tweet.id_str,
          created: tweet.created_at.substring(0, tweet.created_at.length - 11)
        };
      });

      fs.writeFile('site/data/import/tweets.json', JSON.stringify(tweets), function(err) {
        if(err) {
          console.warn(err);
        } else {
          console.log('Tweets data saved.');
          cb();
        }
      });
    }
  });
});

gulp.task('data:twitter-likes', (cb) => {

  let params = {screen_name: 'dydric', count: 4};

  client.get('favorites/list', params, function (error, tweets) {
    if (!error) {

      tweets = tweets.map((tweet) => {

        // console.log(tweet);
        return {
          text:  tweet.text,
          url:   'https://twitter.com/dydric/status/' + tweet.id_str,
          created: tweet.created_at.substring(0, tweet.created_at.length - 11),
          from: tweet.user.name
        };
      });

      fs.writeFile('site/data/import/likes.json', JSON.stringify(tweets), function(err) {
        if(err) {
          console.warn(err);
        } else {
          console.log('Likes data saved.');
          cb();
        }
      });
    }
  });
});

// Global data task
gulp.task('data', [
  'data:twitter', 'data:twitter-likes', 'data:health', 'data:workouts', 'data:spotify'
]);

// Compile Tailwind
gulp.task('css:compile', function() {
  return gulp.src(paths.sass.source)
    .pipe(plumber({ errorHandler: onError }))
    .pipe(sass())
    .pipe(postcss([tailwindcss('./tailwind.config.js')]))
    .pipe(rename({extname: '.css'}))
    .pipe(gulp.dest(paths.sass.dest));
});

// Minify CSS
gulp.task('css:minify', ['css:compile'], function() {
  return gulp.src([
    './assets/css/style.css',
    '!./assets/css/*.min.css'
  ])
    .pipe(cleanCSS())
    .pipe(rename({suffix: '.min'}))
    .pipe(gulp.dest('./assets/css'));
});

// Run all CSS tasks
gulp.task('css', ['css:minify']);

// Concatinate and Compile Scripts
gulp.task('js:compile', function () {
  return gulp.src(paths.javascript.source)
    .pipe(plumber({ errorHandler: onError }))
    .pipe(babel({
      presets: ['@babel/env'],
      sourceType: 'script'
    }))
    .pipe(concat('script.js'))
    .pipe(gulp.dest(paths.javascript.dest));
});

// Minify Scripts
gulp.task('js:minify', function() {
  return gulp.src(paths.javascript.dest + 'script.js')
    .pipe(rename({suffix: '.min'}))
    .pipe(uglify())
    .pipe(gulp.dest(paths.javascript.dest));
});

// Run all JS tasks
gulp.task('js', ['js:minify']);

// Default Gulp task
gulp.task('default', ['data', 'css', 'js:compile']);

// Dev task
gulp.task('dev', ['css', 'js:compile'], function () {
  gulp.watch(['site/*.njk', 'site/includes/**/*.njk'], ['css']);
  gulp.watch('./tailwind.config.js', ['css']);
  gulp.watch('./resources/sass/**/*.scss', ['css']);
  gulp.watch('./resources/js/**/*.js', ['js:compile']);
});

// CSS Preflight
gulp.task('css:compile:preflight', function () {
  return gulp.src(paths.sass.source)
    .pipe(sass())
    .pipe(postcss([
      tailwindcss('./tailwind.config.js'),
      purgecss({
        content: [
          'site/*.njk',
          'site/includes/**/*.njk'
        ],
        extractors: [
          {
            extractor: TailwindExtractor,
            extensions: ['html', 'njk']
          }
        ],
        whitelist: [
          'body',
          'html',
          'h1',
          'h2',
          'h3',
          'p',
          'blockquote',
          'ul',
          'ol',
          'table',
          'emoji'
        ]
      })
    ]))
    .pipe(rename({extname: '.css'}))
    .pipe(gulp.dest('assets/css/'));
});

// Minify CSS [PREFLIGHT]
gulp.task('css:minify:preflight', ['css:compile:preflight'], function () {
  return gulp.src([
    './assets/css/*.css',
    '!./assets/css/*.min.css'
  ])
    .pipe(cleanCSS())
    .pipe(rename({suffix: '.min'}))
    .pipe(gulp.dest('./assets/css'));
});

// Run all CSS tasks
gulp.task('css:preflight', ['css:minify:preflight']);

// Build task
gulp.task('build', ['data', 'css:preflight', 'js:minify']);
