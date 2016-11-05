'use strict';

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
  Schema = mongoose.Schema,
  path = require('path'),
  config = require(path.resolve('./config/config'));

var PropertySchema = new Schema({
  name: {
    type: String,
    default: '',
    trim: true
    //required: 'Property Name cannot be blank'
  },
  path: {
    type: String,
    default: '',
    trim: true
    //required: 'Property Path cannot be blank'
  },
  matches: {
    href: {
      type: Boolean,
      default: false,
      trim: true
    },
    src: {
      type: Boolean,
      default: false,
      trim: true
    },
    alt: {
      type: Boolean,
      default: false,
      trim: true
    },
    content: {
      type: Boolean,
      default: false,
      trim: true
    },
    text: {
      type: Boolean,
      default: false,
      trim: true
    },
    html: {
      type: Boolean,
      default: false,
      trim: true
    }
  },
  regexp: {
    type: String,
    default: '^()(.+)()$',
    trim: true
  },
  indexing: {
    multi: {
      type: Boolean,
      default: false,
      trim: true
    },
    no: {
      type: Boolean,
      default: false,
      trim: true
    }
  },
  deep: {
    enable: {
      type: Boolean,
      default: false,
      trim: true
    },
    depth: {
      type: Number,
      default: 0,
      trim: true,
    },
    force: {
      type: Boolean,
      default: false,
      trim: true
    }
  },
  sort: {
    type: Number,
    default: 0,
    trim: true,
    required: 'Sort No. cannot be blank'
  }
});


var type = {
  values: 'scraper indexer'.split(' '),
  message: 'enum validator failed for path `{PATH}` with value `{VALUE}`'
};

var state = {
  values: 'new reserved processing progress complete partial'.split(' '),
  message: 'enum validator failed for path `{PATH}` with value `{VALUE}`'
};

// var archive = {
//   values: 'no yes'.split(' '),
//   message: 'enum validator failed for path `{PATH}` with value `{VALUE}`'
// };

var strategy = {
  values: 'source manual parameter api'.split(' '),
  message: 'enum validator failed for path `{PATH}` with value `{VALUE}`'
};

var frequency = {
  values: 'manual 30-seconds 1-hour 3-hours 6-hours 12-hours 24-hours 1-week specific'.split(' '),
  message: 'enum validator failed for path `{PATH}` with value `{VALUE}`'
};

var buffer = {
  values: 'none 1 2 3 4 5 10 20 30 60 120 180 240 300 360 480 720'.split(' '),
  message: 'enum validator failed for path `{PATH}` with value `{VALUE}`'
};

var behavior = {
  values: 'default range list'.split(' '),
  message: 'enum validator failed for path `{PATH}` with value `{VALUE}`'
};

var paramtype = {
  values: 'path query'.split(' '),
  message: 'enum validator failed for path `{PATH}` with value `{VALUE}`'
};

var forwardPages = {
  values: '2 5 10 20 30 50 100'.split(' '),
  message: 'enum validator failed for path `{PATH}` with value `{VALUE}`'
};

var devices = {
  values: Object.keys(config.emulateDevices),
  message: 'enum validator failed for path `{PATH}` with value `{VALUE}`'
};

mongoose.model('Property', PropertySchema);
/**
 * Article Schema
 */
var CrawlerSchema = new Schema({
  created: {
    type: Date,
    default: Date.now
  },
  name: {
    type: String,
    default: '',
    trim: true,
    required: 'API Name cannot be blank'
  },
  description: {
    type: String,
    default: '',
    trim: true
  },
  url: {
    type: String,
    default: '',
    trim: true,
    required: 'Source URL cannot be blank'
  },
  type: {
    type: String,
    enum: type,
    default: 'scraper',
    trim: true,
    required: 'Crawler type cannot be blank'
  },
  status: {
    type: String,
    enum: state,
    default: 'new',
    trim: true,
    required: 'Status cannot be blank'
  },
  nextRunAt: {
    type: Date,
    default: Date.now
  },
  archive: {
    type: Number,
    default: 2,
    trim: true,
    required: 'archive cannot be blank'
  },
  strategy: {
    selected: {
      type: String,
      enum: strategy,
      default: 'source',
      trim: true,
      required: 'strategy cannot be blank'
    },
    content: {
      manual:     {type: String},
      api:        [{type: String}],
      forward: {
        page: {
          type: String,
          enum: forwardPages,
        default: '10'
        }
      },
      parameter:  [{
        num: {
          type: Number,
          default: 0,
          trim: true
        },
        param: {type: String},
        paramtype: {
          type: String,
          enum: paramtype,
          default: 'path'
        },
        exp: {
          type: String,
          default: '^()(.+)()$',
          trim: true
        },
        behavior: {
          type: String,
          enum: behavior,
          default: 'default'
        },
        content: {
          list: {type: String},
          start: {type: Number},
          end: {type: Number}
        }
      }]
    },
    urls: []
  },
  frequency: {
    selected: {
      type: String,
      enum: frequency,
      default: 'manual',
      trim: true,
      required: 'strategy cannot be blank'
    },
    content: {
      type: String,
      trim: true,
    }
  },
  buffer: {
    selected: {
      type: String,
      enum: buffer,
      default: 'none',
      trim: true,
      required: 'buffer cannot be blank'
    }
  },
  properties: [PropertySchema],
  crawls: [{
    type: Schema.ObjectId,
    ref: 'Crawl'
  }],
  idx: {
    type: Schema.ObjectId,
    ref: 'Idx'
  },
  basepath: {
    type: String,
    default: '',
    trim: true
  },
  forwarding: {
    path: {
      type: String,
      default: '',
      trim: true
    },
    pages: {
      type: Number,
      default: 10
    }
  },
  filter: {
    source: {
      type: String,
      default: '// Input: data = All rows which is lastest crawl data.\n// Output (return): required.\n\nfor (var i=0; i<data.length; i++) {\n  // if (data[i].hasOwnProperty("target property")) {\n  //   Do something.\n  // }\n}\n\nreturn data;\n\n\n'
    },
    errors: []
  },
  emulate: {
    device: {
      type: String,
      enum: devices,
      default: 'macSafari'
    }
  },
  capture: {
    enable: {
      type: Boolean,
      default: false,
    },
    path: {
      type: String,
      default: 'uploads/',
      required: 'capture save path cannot be blank'
    }
  },
  user: {
    type: Schema.ObjectId,
    ref: 'User'
  }
});

mongoose.model('Crawler', CrawlerSchema);
