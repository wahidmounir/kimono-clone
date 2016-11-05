'use strict';

var defaultEnvConfig = require('./default');

module.exports = {
  db: {
    uri: process.env.MONGOHQ_URL || process.env.MONGOLAB_URI || 'mongodb://' + (process.env.DB_1_PORT_27017_TCP_ADDR || 'localhost') + '/mean-dev',
    options: {
      user: '',
      pass: ''
    },
    // Enable mongoose debug mode
    debug: process.env.MONGODB_DEBUG || false
  },
  log: {
    // Can specify one of 'combined', 'common', 'dev', 'short', 'tiny'
    format: 'dev',
    // Stream defaults to process.stdout
    // Uncomment to enable logging to a log on the file system
    options: {
      //stream: 'access.log'
    }
  },
  app: {
    title: defaultEnvConfig.app.title + ' - Development Environment',
  },
  facebook: {
    clientID: process.env.FACEBOOK_ID || 'APP_ID',
    clientSecret: process.env.FACEBOOK_SECRET || 'APP_SECRET',
    callbackURL: '/api/auth/facebook/callback'
  },
  twitter: {
    clientID: process.env.TWITTER_KEY || 'CONSUMER_KEY',
    clientSecret: process.env.TWITTER_SECRET || 'CONSUMER_SECRET',
    callbackURL: '/api/auth/twitter/callback'
  },
  google: {
    clientID: process.env.GOOGLE_ID || 'APP_ID',
    clientSecret: process.env.GOOGLE_SECRET || 'APP_SECRET',
    callbackURL: '/api/auth/google/callback'
  },
  linkedin: {
    clientID: process.env.LINKEDIN_ID || 'APP_ID',
    clientSecret: process.env.LINKEDIN_SECRET || 'APP_SECRET',
    callbackURL: '/api/auth/linkedin/callback'
  },
  github: {
    clientID: process.env.GITHUB_ID || 'APP_ID',
    clientSecret: process.env.GITHUB_SECRET || 'APP_SECRET',
    callbackURL: '/api/auth/github/callback'
  },
  paypal: {
    clientID: process.env.PAYPAL_ID || 'CLIENT_ID',
    clientSecret: process.env.PAYPAL_SECRET || 'CLIENT_SECRET',
    callbackURL: '/api/auth/paypal/callback',
    sandbox: true
  },
  mailer: {
    from: 'meganekicksys@gmail.com' || process.env.MAILER_FROM,
    options: {
      service: 'Gmail' || process.env.MAILER_SERVICE_PROVIDER,
      debug: false,
      auth: {
         user: 'meganekicksys@gmail.com',
         pass: '?4527?8V'
        // XOAuth2: {
        //   user: 'meganekicksys@gmail.com', // Your gmail address.
        //   clientId: '343686910203-m34qn4gr9herka6egtmok1ns2m2ch881.apps.googleusercontent.com',
        //   clientSecret: 'zfzb6J4zdZZaeqr6H7zWBC_F',
        //   refreshToken: '1/JQZgG5Ei5iuG7dlmppxCYxj1n_upnXULTWC5thS186Y',
        //   accessToken: 'ya29.Ci83A5R6iZIzy_gycECC_UETKCjadbzbTMDI1-DT9guz1qwCI9aZ5cngxiHq9I4YSw'
        // }
      }
    }
  },
  livereload: true,
  seedDB: process.env.MONGO_SEED || false, 

  // Wacwac P/F - administration setting
  admin: {
    systemReport: {
      enable: true,
      term: '1 day'
    },
    crawlReport: { 
      enable: true,
      term: '1 day'
    }
  },

  // [Kimono-clone] Agenda settings
  agenda: {
    collection: 'agendajobs',
    processEvery: '1 second'
  },
};
