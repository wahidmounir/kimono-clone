'use strict';

module.exports = {
  app: {
    title: 'Wacwac P/F',
    description: 'Full-Stack JavaScript with MongoDB, Express, AngularJS, and Node.js',
    keywords: 'MongoDB, Express, AngularJS, Node.js',
    googleAnalyticsTrackingID: process.env.GOOGLE_ANALYTICS_TRACKING_ID || 'GOOGLE_ANALYTICS_TRACKING_ID'
  },
  port: process.env.PORT || 3000,
  templateEngine: 'swig',
  // Session Cookie settings
  sessionCookie: {
    // session expiration is set by default to 24 hours
    maxAge: 24 * (60 * 60 * 1000),
    // httpOnly flag makes sure the cookie is only accessed
    // through the HTTP protocol and not JS/browser 
    httpOnly: true,
    // secure cookie should be turned to true to provide additional
    // layer of security so that the cookie is set only when working
    // in HTTPS mode.
    secure: false
  },
  // sessionSecret should be changed for security measures and concerns
  sessionSecret: 'MEAN',
  // sessionKey is set to the generic sessionId key used by PHP applications
  // for obsecurity reasons
  sessionKey: 'sessionId',
  sessionCollection: 'sessions',
  logo: 'modules/core/client/img/brand/logo.png',
  favicon: 'modules/core/client/img/brand/favicon.ico',
  
  admin: {
    email: 'meganekick@gmail.com'
  },
  // [Kimono-clone] Agenda settings
  agenda: {
    collection: 'agendajobs',
    processEvery: '1 second'
  },
  crawler: {
    concurrency: 5
  },
  // [Kimono-clone] Device emulation
  emulateDevices: {
    macSafari: {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_5) AppleWebKit/601.5.17 (KHTML, like Gecko) Version/9.1 Safari/601.5.17',
      viewportWidth: 1440,
      viewportHeight: 900
    },
    iphone6Safari: {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 9_1 like Mac OS X) AppleWebKit/601.1.46 (KHTML, like Gecko) Version/9.0 Mobile/13B143 Safari/601.1',
      viewportWidth: 375,
      viewportHeight: 667
    }
  },
  recaptcha: {
    sitekey: '6Ld6mB0TAAAAAGI18s6tR_MeXQDzO3V1UGWWLF1C',
    secret: '6Ld6mB0TAAAAAGFwy6yVG-KJVHmOMYxNEv2AF-_b'
  }
};
