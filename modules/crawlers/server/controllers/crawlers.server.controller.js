'use strict';

/**
 * Module dependencies.
 */
var path = require('path'),
  fs = require('fs'),
  config = require(path.resolve('./config/config')),
  mongoose = require('mongoose'),
  JSHINT = require('jshint').JSHINT,
  URI = require('urijs'),
  Crawler = mongoose.model('Crawler'),
  Crawl = mongoose.model('Crawl'),
  Log = mongoose.model('Log'),
  errorHandler = require(path.resolve('./modules/core/server/controllers/errors.server.controller')),
  // logger
  logger = require(path.resolve('./modules/core/server/controllers/logger.server.controller')),
  // クロール
  crawls = require(path.resolve('./modules/crawls/server/controllers/crawls.server.controller.js')),
  idxes = require(path.resolve('./modules/idxes/server/controllers/idxes.server.controller.js')),
  Property = mongoose.model('Property'),
  agenda = require(path.resolve('./config/lib/agenda.js')),
  manager = require('port-manager')();

/**
 * Create a crawler
 * [TODO] properties対応する
 */
exports.create = function (req, res) {
  var crawler = new Crawler(req.body);
  crawler.user = req.user;
  crawler.idx = idxes.ready({crawler: crawler}, function () {
    crawler.save(function (err) {
      if (err) {
        return res.status(400).send({
          message: errorHandler.getErrorMessage(err)
        });
      } else {
        res.json(crawler);
      }
    });
  });
};

/**
 * Show the current crawler
 */
exports.read = function (req, res) {
  res.json(req.crawler);
};

/**
 * Update a crawler
 */
exports.update = function (req, res) {
  var crawler = req.crawler;
  
  if (crawler.url !== req.body.url) {
    crawler.strategy.urls = [];
    crawler.strategy.content.parameter = [];
  } else {
    crawler.strategy.content = req.body.strategy.content;
  }
  
  crawler.name = req.body.name;
  crawler.description = req.body.description;
  crawler.url = req.body.url;
  crawler.type = req.body.type;
  crawler.status = req.body.status;
  crawler.archive = req.body.archive;
  crawler.strategy.selected = req.body.strategy.selected;
  crawler.frequency.selected = req.body.frequency.selected;
  crawler.frequency.content = req.body.frequency.content;
  crawler.buffer.selected = req.body.buffer.selected;
  crawler.properties = req.body.properties;
  crawler.basepath = req.body.basepath;
  crawler.forwarding = req.body.forwarding;
  crawler.filter.source = req.body.filter.source;
  crawler.emulate = req.body.emulate;

  // idxが無いcrawlerへのidx作成の対応
  var promise = new Promise (function (resolve, reject) {
    Crawler.findById(req.crawler._id).populate('idx', '_id').exec(function (err, cr) {
      if (err) {
        reject(err);
      } else {
        resolve(cr);
      }
    });
  });
  promise = promise.then(function (cr) {
    return new Promise (function (resolve, reject) {
      if (!crawler.idx) {
        idxes.ready({crawler: crawler}, function (idx) {
          cr.idx = idx;
          resolve(cr);
        });
      } else {
        reject();
      }
    });
  }).then(function (cr) {
    cr.save(function (err) {
      if (err) {
        Promise.reject(err);
      }
    });
  }).catch(function (err) {
    if (err) {
      // console.log(err);
      return res.status(400).send({
        message: errorHandler.getErrorMessage(err)
      });
    }
  });
  // idx対応ここまで

  promise.then(function () {
    // クロール時キャプチャのpath
    try {
      fs.accessSync(req.body.capture.path);
    } catch (e) {
      return res.status(400).send({
        message: errorHandler.getErrorMessage(e)
      });
    }
    crawler.capture = req.body.capture;

    // バリデーション（crawlerタイプがindexerの場合）
    if (crawler.type === 'indexer') {
      var indexerIsValid = false;

      crawler.properties.forEach(function (prop, i) {
        if (prop.name === 'link' &&
          prop.matches.href === true) {
          indexerIsValid = true;
        }
      });

      if (! indexerIsValid) {
        return res.status(400).send({
          message: 'Crawler type "indexer" must has "link" named property and checked "href" attribute.'
        });
      }
    }
    
    // フィルタースクリプト
    JSHINT(crawler.filter.source, {undef: true}, {data: false});
    if (JSHINT.errors.length >= 1) {
      crawler.filter.errors = JSHINT.errors;
    } else {
      crawler.filter.errors = [];
    }

    // クロールURL
    exports.requestUrlList([{crawler: crawler, user:req.user}, function (urls, err) {
      crawler.strategy.urls = urls;
      
      // crawlerの保存
      crawler.save(function (err) {
        if (err) {
          return res.status(400).send({
            message: errorHandler.getErrorMessage(err)
          });
        } else {
          req.crawler = crawler;
          exports.clearCrawlerJob({req:req, res:res}, function () {
            if (req.body.frequency.selected !== 'manual') {
              exports.reserve(req, res);
            }
            res.status(200).json(crawler);
          });
        }
      });
    }]);
  });
};

exports.requestUrlList = function (args) {
  var urls = [];

  // URL取得がAPIの場合
  if (args[0].crawler.strategy.selected === 'api' && args[0].crawler.strategy.content.api.length >= 1) {
    Crawler.find({"_id": {$in: args[0].crawler.strategy.content.api}}).populate('crawls', 'record').exec(function (err, apicrawler) {
      if (err) {
        logger.error('Cannot be found. (crawler)', {type:'system', crawlerId: args[0].crawler.strategy.content.api, crawlerName:args[0].crawler.name, error:err});
      } else if (!apicrawler) {
        logger.error('No crawler with that identifier has been found. (crawler)', {type:'system', crawlerId: args[0].crawler.strategy.content.api, crawlerName:args[0].crawler.name});
      }
      
      var tmp = [];
      for (var a=0; a<apicrawler.length; a++) {
        if (apicrawler[a].crawls.length >= 1) {
          for (var u=0; u<apicrawler[a].crawls[0].record.length; u++) {
            for (var c=0; c<apicrawler[a].crawls[0].record[u].length; c++) {
              if (apicrawler[a].crawls[0].record[u][c].name === 'link') {
                // urls.push(apicrawler[a].crawls[0].record[u][c].content);
                tmp.push({
                  link: apicrawler[a].crawls[0].record[u][c].content
                });
              }
            }
          }
          /*jshint -W054 */
          var customJsFilterFunc = new Function('data', apicrawler[a].filter.source);
          /*jshint +W054 */
          
          var rows = customJsFilterFunc(tmp);
          for (var r=0; r<rows.length; r++) {
            if (rows[r].hasOwnProperty('link')) {
              urls.push(rows[r].link);
            }
          }
        }
      }

      logger.debug('updateUrlList: ', {urls: urls});
      args[1](urls);
    
    });

  // URL取得がパラメータ生成の場合
  } else if (args[0].crawler.strategy.selected === 'parameter') {
    var loopForUrlGenerate = function (url, params, pos, isQuery, urls) {
      var ls = [];
      var dl = "";
      // Delimiter definition
      if (params[pos].paramtype === 'path') {dl = '/';}
      else if (params[pos].paramtype === 'query') {
        if (isQuery === false) {
          dl = '?';
          isQuery = true;
        }
        else {dl = '&';}
      }
  
      // Generating list
      if (params[pos].behavior === 'list') {
        // In case behavior == list
        if (params[pos].exp) {
          var tmpls = params[pos].content.list.replace(' ', '').split(',');
          for (var s=0; s<tmpls.length; s++) {
            ls.push(params[pos].param.replace(new RegExp(params[pos].exp), '$1'+tmpls[s]+'$3'));
          }
        }
        else {
          ls = params[pos].content.list.replace(' ', '').split(',');
        }
      } else if (params[pos].behavior === 'range') {
        // In case behavior == rage
        for (var r=params[pos].content.start; r<=params[pos].content.end; r++) {
          if (params[pos].exp) {
            // var match = params[pos].param.match(new RegExp(params[pos].exp));
            // console.log(params[pos].param);
            // console.log(params[pos].exp);
            // console.log(match);
            // if (match !== null && match.length >= 3) {
            //   ls.push(match[1]+r+match[3]);
            // }
            ls.push(params[pos].param.replace(new RegExp(params[pos].exp), '$1'+r+'$3'));
          } else {
            ls.push(r);
          }
        }
      }
      else {
        // Case that is behavior == default
        ls[0] = params[pos].param;
      }
  
      for (var l=0; l<ls.length; l++) {
        if (pos === params.length-1) {
          urls.push(url+dl+ls[l]);
        } else {
          loopForUrlGenerate(url+dl+ls[l], params, pos+1, isQuery, urls);
        }
      }
      return urls;
    };
    
    var uri = URI(args[0].crawler.url);
    //var pathnames = uri.pathname();
    //var queries = uri.query();
    var params = args[0].crawler.strategy.content.parameter;
    var pos = 0;
    var isQuery = false;
    if (params.length >= 1) {
      urls = loopForUrlGenerate(uri.protocol()+'://'+uri.host(), params, pos, isQuery, urls);
    }
    args[1](urls);

  // URL取得がsource urlのみの場合
  } else if (args[0].crawler.strategy.selected === 'source') {
    urls[0] = args[0].crawler.url;
    args[1](urls);

  // URL取得がURLリストの場合
  } else if (args[0].crawler.strategy.selected === 'manual' || args[0].crawler.strategy.selected === 'forward') {
    if (args[0].crawler.strategy.content.manual === "") {
      urls[0] = args[0].crawler.url;
    } else {
      if (args[0].crawler.strategy.content.manual) {
        urls = args[0].crawler.strategy.content.manual.split('\n');
      }
    }
    args[1](urls);

  // URL取得が上記以外
  } else {
    args[1](urls);
  }
};


/**
 * Delete an crawler
 */
exports.delete = function (req, res) {
  var crawler = req.crawler;

  crawler.remove(function (err) {
    if (err) {
      return res.status(400).send({
        message: errorHandler.getErrorMessage(err)
      });
    } else {
      res.json(crawler);
    }
  });
};

/**
 * List of crawlers
 */
exports.list = function (req, res) {
  var cond = null;
  
  if (req.query.srchwd) {
    cond = {
      $or: [{
        name: {
          $regex: req.query.srchwd,
          $options: 'si'
        }}, {
        description: {
          $regex: req.query.srchwd,
          $options: 'sim'
      }}]
    };
  }

  Crawler.find(cond).sort('-created').populate('crawls', 'progress').populate('user', 'displayName').exec(function (err, crawlers) {
    if (err) {
      return res.status(400).send({
        message: errorHandler.getErrorMessage(err)
      });
    } else {
      res.json(crawlers);
    }
  });
};

/**
 * List of crawlers
 */
exports.listByUser = function (req, res) {
  Crawler.find({'user': req.user}).sort('-created').populate('user', 'displayName').exec(function (err, crawlers) {
    if (err) {
      return res.status(400).send({
        message: errorHandler.getErrorMessage(err)
      });
    } else {
      res.json(crawlers);
    }
  });
};

/**
* Paginate List of Crawler
**/
exports.crawlersList = function(req, res){
  var resdata = {count:0, crawlers:[]};
  var page = 1;
  if(req.params.page) {
    page = req.params.page;
  }
  var per_page = 20;
  if(req.params.per) {
    per_page = req.params.per;
  }
  
  var cond = null;
  if (req.params.srchwd) {
    cond = {
      $or: [{
        name: {
          $regex: req.params.srchwd,
          $options: 'si'
        }}, {
        description: {
          $regex: req.params.srchwd,
          $options: 'sim'
      }}]
    };
  }

  Crawler.find(cond).limit(1000).count(function(err, count) {
    if (err) {
      return res.status(400).send({
        message: errorHandler.getErrorMessage(err)
      });
    } else {
      resdata.count = count;
  
      Crawler.find(cond).limit(100000).sort('-created').skip((page-1)*per_page).limit(per_page).exec(function(err, crawlers) {
        if (err) {
          return res.status(400).send({
            message: errorHandler.getErrorMessage(err)
          });
        } else {
          resdata.crawlers = crawlers;
          res.json(resdata);
        }
      });
    }
  });
};

/**
 * List of crawlers thru the API
 */
exports.data = function (req, res) {
  if (!mongoose.Types.ObjectId.isValid(req.crawler._id.toString())) {
    return res.status(400).send({
      message: 'Crawler is invalid'
    });
  }

  Crawler.findById(req.crawler._id).populate('user', 'displayName').populate('crawls').exec(function (err, crawler) {
    if (err) {
      return res.status(400).send({
        message: 'Crawler is invalid'
      });
    } else if (!crawler) {
      return res.status(404).send({
        message: 'No crawler with that identifier has been found'
      });
    }
    
    var data = {};
    data.name = crawler.name;
    data.created = crawler.created;
    data.status = crawler.status;
    data.rows = [];
    
    if (crawler.crawls.length >= 1) {
      data.lastcrawl = {
        id: crawler.crawls[0]._id,
        date: crawler.crawls[0].updated,
      };
      
      /*jshint -W083 */
      for (var i=0; i<crawler.crawls[0].record.length; i++) {
        var r = {};
        crawler.crawls[0].record[i].forEach(function (current) {
          if (['wac@@index','wac@@url','wac@@hash'].indexOf(current.name) >= 0) {
            r[current.name.replace('@@', '.')] = current.content;
          }
          crawler.properties.forEach(function (prop) {
            if (prop.name === current.name) {
              r[prop.name] = current.content;
            } else if (current.name.indexOf(prop.name+'@') >= 0) {
              r[current.name.replace('@', '.')] = current.content;
            } else if (r.hasOwnProperty(prop.name) === false) {
              r[prop.name] = "";
            }
          });
          r['wac.index'] = i+1;
        });
        data.rows.push(r);
      }
      /*jshint +W083 */
    }
    
    if (crawler.filter.source !== "" && crawler.filter.errors.length === 0) {
      JSHINT(crawler.filter.source, {undef: true}, {data: false});
      if (JSHINT.errors.length >= 1) {
        logger.error('JSHINT have been warned JavaScript error. (crawler)', {type:'system', crawlerId: crawler._id.toString(), crawlerName:crawler.name, user:req.user.toObject(), error: JSHINT.errors});
        return res.status(500).send({
          message: 'JSHINT have been warned JavaScript error.'
        });
      }
      
      /*jshint -W054 */
      var customJsFilterFunc = new Function('data', crawler.filter.source);
      /*jshint +W054 */
      
      data.rows = customJsFilterFunc(data.rows);
    }
    
    if (req.extension === 'json') {
      res.json(data.rows);
    } else if (req.extension === 'csv') {
      if (data.rows.length >= 1) {
        data.rows.unshift(Object.keys(data.rows[0]));
      }
      res.csv(data.rows);
    }
    
  });
};

/**
 * crawler middleware
 */
exports.crawlerByID = function (req, res, next, id) {

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).send({
      message: 'Crawler is invalid'
    });
  }

  Crawler.findById(id).populate('user', 'displayName').populate('crawls', '_id updated progress').populate('idx', '_id').exec(function (err, crawler) {
    if (err) {
      return next(err);
    } else if (!crawler) {
      return res.status(404).send({
        message: 'No crawler with that identifier has been found'
      });
    }
    req.crawler = crawler;
    next();
  });
};


exports.detectExtension = function (req, res, next, ext) {
  req.extension = ext;
  next();
};

exports.status = function (req, res) {
  req.crawler.status = 'new';

  agenda.jobs({
    name: 'Crawler Schedule', 'data.crawler_id': req.crawler._id.toString()
  }, function (err, jobs) {
    if (jobs.length >= 1) {
      req.crawler.status = 'scheduled';
    }
    agenda.jobs({
      name: 'Crawler Crawl', 'data.crawler_id': req.crawler._id.toString()
    }, function clearCrawlerJobJobs(err, jobs) {
      if (jobs.length >= 1) {
        // クロール中の場合
        req.crawler.status = 'progress';
      } else if (req.crawler.crawls.length >= 1) {
        // クロール履歴あり
        if (req.crawler.crawls[0].progress.error >= 1) {
          // エラーが1件以上の場合
          req.crawler.status = 'partial';
        }
        else {
          req.crawler.status = 'complete';
        }
      }

      res.json(req.crawler);
    });
  });
};

function strToValueFrequency (str) {
  return str.replace('-', ' ');
}

exports.clearCrawlerJob = function (args, callback) {
  agenda.jobs({
    name: 'Crawler Schedule', 'data.crawler_id': args.req.crawler._id.toString()
  }, function clearCrawlerJobReserveJobs(err, jobs) {
    if (err) {
      logger.error('Cannot be canceled any reserved jobs. (crawler)', {type:'system', crawlerId: args.req.crawler._id.toString(), crawlerName:args.req.crawler.name, user:args.req.crawler.user._id.toString(), error:err});
    }
    else if (jobs.length === 0) {
      logger.info('Should be canceled any reserved jobs are not found. (crawler)', {type:'system', crawlerId: args.req.crawler._id.toString(), crawlerName:args.req.crawler.name, user:args.req.crawler.user._id.toString()});
    }
    jobs.forEach (function (job) {
      job.remove(function clearCrawlerJobReserveJobsRemove(err) {
        if (err) {logger.error('Jobs cannot be removed. (crawler)', {type:'system', crawlerId: args.req.crawler._id.toString(), crawlerName:args.req.crawler.name, user:args.req.crawler.user._id.toString(), error:err});}
        logger.info('Reserved job is removed: crawler_id = '+args.req.crawler._id+' (crawler)', {type:'system', crawlerId: args.req.crawler._id.toString(), crawlerName:args.req.crawler.name, userId:args.req.crawler.user._id.toString()});
      });
    });

    agenda.jobs({
      name: 'Crawler Crawl', 'data.crawler_id': args.req.crawler._id.toString()
    }, function clearCrawlerJobJobs(err, jobs) {
      if (err) {
        logger.error('Cannot be canceled any jobs. (crawler)', {type:'system', crawlerId: args.req.crawler._id.toString(), crawlerName:args.req.crawler.name, user:args.req.crawler.user._id.toString(), error:err});
      }
      else if (jobs.length === 0) {
        logger.info('Should be canceled any jobs are not found. (crawler)', {type:'system', crawlerId: args.req.crawler._id.toString(), crawlerName:args.req.crawler.name, user:args.req.crawler.user._id.toString()});
      }
      jobs.forEach (function (job) {
        job.remove(function clearCrawlerJobJobsRemove(err) {
          if (err) {logger.error('Jobs cannot be removed. (crawler)', {type:'system', crawlerId: args.req.crawler._id.toString(), crawlerName:args.req.crawler.name, user:args.req.crawler.user._id.toString(), error:err});}
          logger.info('Job is removed: crawler_id = '+args.req.crawler._id+' (crawler)', {type:'system', crawlerId: args.req.crawler._id.toString(), crawlerName:args.req.crawler.name, user:args.req.crawler.user._id.toString()});
        });
      });

      callback();
    });
  });
};

/**
 * reserve - クロールの予約
 * 
 ** できること
 * 実行時間を指定して次回クロールを予約する
 *  - 必要なソースURLの取得などは実行時に取得する
 */
exports.reserve = function (req, res) {
  // jobのキャンセル
  // exports.clearCrawlerJob({req:req, res:res}, function () {
  
    // jobの予約
    var job = agenda.create('Crawler Schedule', {
      crawler_id: req.crawler._id.toString(),
      crawlerName: req.crawler.name,
      user: req.crawler.user.toObject()
    });
    if (req.crawler.frequency.selected === 'specific' && req.crawler.frequency.content) {
      job.repeatEvery(req.crawler.frequency.content);
    } else {
      job.repeatEvery(strToValueFrequency(req.crawler.frequency.selected));
    }
    job.unique({'data.type': 'active', 'data.crawler_id': req.crawler._id.toString()});
    job.save(function saveReservation(err){
      if (err) {
        logger.error('Queue cannot reserve. (crawler)', {type:'system', crawlerId: req.crawler._id.toString(), crawlerName:req.crawler.name, userDisplayName:req.crawler.user.displayName, error:err});
      }
      if( !err ) {
        logger.info( 'Job reserved: crawler id = '+req.crawler._id+' (crawler)', {type:'system', crawlerId: req.crawler._id.toString(), crawlerName:req.crawler.name, userDisplayName:req.crawler.displayName});
        // exports.updateCrawlerStatus(req.crawler._id, 'reserved', req.user.toObject());
        req.crawler.save(function (err) {
          if (err) {
            logger.error('Cannot be saved crawler. (crawler)', {type:'system', crawlerId: req.crawler._id, userDisplayName:req.crawler.user.displayName});
          }
          else {
            logger.info( 'Crawler status updated: status = reserved (crawler)', {type:'system', crawlerId: req.crawler._id.toString(), userDisplayName:req.crawler.user.displayName});
          }
        });
      }
    });
  // });
};

agenda.define('Crawler Schedule', {concurrency: 1}, function ( job, done ) {
  exports.start({crawlerId: job.attrs.data.crawler_id}, done);
});

agenda.on('complete:Crawler Schedule', function(job) {
  Crawler.findById(job.attrs.data.crawler_id).exec(function (err, crawler) {
    if (err) {
      logger.error('Cannot be found. (crawler)', {type:'system', crawlerId: job.attrs.data.crawler_id, error:err});
    } else if (!crawler) {
      logger.error('No crawler with that identifier has been found. (crawler)', {type:'system', crawlerId: job.attrs.data.crawler_id, error:err});
    }

    crawler.nextRunAt = job.attrs.nextRunAt;

    crawler.save(function (err) {
      if (err) {
        logger.error('Crawler cannot be saved. (crawler)', {type:'system', crawlerId: job.attrs.data.crawler_id, error:err});
      }
    });
  });
  
});


exports.now = function (req, res) {
  if (req.crawler.frequency.selected !== 'manual') {
    exports.clearCrawlerJob({req:req, res:res}, function () {
      exports.reserve(req, res);
    });
  } else {
    exports.clearCrawlerJob({req:req, res:res}, function () {
      exports.start({crawlerId: req.crawler._id.toString()}, function(){});
    });
  }
  res.json(req.crawler);
};

exports.clear = function (req, res) {
  exports.clearCrawlerJob({req:req, res:res}, function () {
    req.crawler.status = 'new';
    req.crawler.save(function (err) {
      if (err) {
        return res.status(400).send({
          message: errorHandler.getErrorMessage(err)
        });
      } else {
        logger.debug('Crawler jobs are reset');
        res.json(req.crawler);
      }
    });
  });
};


/**
 * start クロール実行
 * strategy設定: 取得するクロール先URLが変化する
 * クロール先URLを取得したらqueueにjob登録する
 */
exports.start = function (args, done) {
  var crawlerId = args.crawlerId;
  
  // 設定を参照してクロール先URLを取得
  Crawler.findById(crawlerId).populate('user', 'displayName').populate('crawls').populate('idx').exec(function (err, crawler) {
    if (err) {
      done();
      logger.error('Cannot be found. (crawler)', {type:'system', crawlerId: crawlerId, userDisplayName:crawler.user.displayName, error:err});
    } else if (!crawler) {
      done();
      logger.error('No crawler with that identifier has been found. (crawler)', {type:'system', crawlerId: crawlerId, userDisplayName:crawler.user.displayName, error:err});
    }

    logger.info('Starting crawl process.', {type: 'crawlerInfo', crawlerName: crawler.name});
    logger.debug("crawler._id: "+crawler._id);
    
    crawls.start([{crawler:crawler}, function (crawl) {
      var createJobs = function (urls) {
        logger.debug('URL List: ', urls);
        if (urls.length === 0) {
          done();
          logger.error('Url list\'s length is 0. (crawler)', {type:'system', crawlerId: crawlerId.toString(), crawlerName:crawler.name, crawlId: crawl._id.toString(), userDisplayName:crawler.user.displayName});
        }
        
        // フィールドをcrawlに保存
        // [TODO] いらない？
        var cols = [];
        crawler.properties.sort(function(a, b) {
          return (a.sort < b.sort) ? -1 : 1;
        });
        for (var p=0; p<crawler.properties.length; p++) {
          cols.push(crawler.properties[p].name);
        }
        cols.push('wac@@url');
        cols.push('wac@@hash');
        crawl.columns = cols;
        // いらない？ここまで

        // クローラステータスと進捗
        crawl.progress.total = urls.length;
        crawl.save(function (err) {
          if (err) {
            done();
            logger.error('Crawl cannot be saved. (crawler)', {type:'system', crawlerId: crawlerId.toString(), crawlerName:crawler.name, crawlId: crawl._id.toString(), userDisplayName:crawler.user.displayName, error:err});
          }

          // crawler.status = 'progress';
          // クロール履歴の処理（捨てるか残す）
          if (crawler.crawls.length　>= crawler.archive) {
            for (var c=crawler.crawls.length; c>=crawler.archive; c--) {
              var trush = crawler.crawls.pop();
              trush.remove();
            }
          }

          // ステータスとクロール履歴処理を保存
          crawler.crawls.unshift(crawl);
          crawler.save(function (err) {
            if (err) {
              logger.error('Crawler cannot be saved. (crawler)', {type:'system', crawlerId: crawlerId.toString(), crawlerName:crawler.name, crawlId: crawl._id.toString(), userDisplayName:crawler.user.displayName, error:err});
              done();
            }
            logger.debug("crawler.idx: "+crawler.idx);

            /*jshint -W083 */
            for (var i=0; i<urls.length; i++) {
              manager.claim(crawl._id.toString()+'@@'+urls[i], function (err, service) {
                var url = service.name.substr(service.name.indexOf('@@')+2);
                var job = agenda.create('Crawler Crawl', {
                  port: service.port,
                  crawlerId: crawler._id.toString(),
                  crawlId: crawl._id.toString(),
                  idxId: crawler.idx._id.toString(),
                  crawlerName:encodeURIComponent(crawler.name),
                  type: crawler.type,
                  basepath: crawler.basepath.toString(),
                  props: crawler.properties.toObject(),
                  deep: {
                    depth: 0,
                    current: 0,
                    force: false
                  },
                  // forwardSelPath: crawler.forwarding.path.toString(),
                  // forwardPagesMax: crawler.forwarding.pages.toString(),
                  // currentPageNum: 1,
                  userDisplayName: encodeURIComponent(crawler.user.displayName),
                  url: url,
                  userAgent: config.emulateDevices[crawler.emulate.device].userAgent,
                  viewportWidth: config.emulateDevices[crawler.emulate.device].viewportWidth,
                  viewportHeight: config.emulateDevices[crawler.emulate.device].viewportHeight,
                  captureEnabled: crawler.capture.enable,
                  captureSavePath: crawler.capture.path
                });
                job.schedule('3 seconds');
                if (args.priority) {
                  job.priority(args.priority);
                }
                job.save(function (err) {
                  if (err) {
                    logger.error('Job has not been created. (crawler)', {type:'system', crawlerId: crawlerId.toString(), crawlerName:crawler.name, crawlId: crawl._id.toString(), userDisplayName:crawler.user.displayName, error:err});
                  }
                });
              });              
            }
            /*jshint +W083 */
            done();
          });
        });
      };
    
      // クロール対象のURLリストを取得してjobを作成
      exports.requestUrlList([{crawler: crawler}, function (urls) {
        createJobs(urls);
      }]);
    }]);
  });
};

agenda.define('Crawler Crawl', {concurrency: config.crawler.concurrency}, function ( job, done ) {
  crawls.crawl(job,done);
});

agenda.on('complete:Crawler Crawl', function(job) {
  job.remove();
});

exports.forward = function (args) {
  var crawlerId = args.crawlerId,
    crawlId = args.crawlId;

  manager.claim(crawlId+'@@'+args.url, function (err, service) {
    var job = agenda.create('Crawler Crawl', {
      port: service.port,
      crawlerId: args.crawlerId,
      crawlId: args.crawlId,
      idxId: args.idxId,
      crawlerName:args.crawlerName,
      type: args.type,
      basepath: args.basepath,
      props: args.props,
      deep: args.deep,
      userDisplayName: args.userDisplayName,
      url: args.url,
      userAgent: args.userAgent,
      viewportWidth: args.viewportWidth,
      viewportHeight: args.viewportHeight,
      captureEnabled: args.captureEnabled,
      captureSavePath: args.captureSavePath
    });
    job.schedule('1 seconds');
    if (args.priority) {
      job.priority(args.priority);
    }
    job.save(function (err) {
      if (err) {
        logger.error('Job has not been created. (crawler)', {type:'system', crawlerId: args.crawlerId, crawlerName:args.crawlerName, crawlId: args.crawlId, userDisplayName:args.userDisplayName, error:err});
      }
    });
  });
    
};


// agenda.define('Closing Crawl', {priority: 'high'}, function ( job, done ) {
//   // クロールの進捗とステータスを更新
//   Crawl.findById(job.attrs.data.crawlId).populate('user', 'displayName').exec(function (err, crawl) {
//     if (err) {
//       done();
//       logger.error('Cannot be found. (crawler)', {type:'system', crawlId: job.attrs.data.crawlId, userDisplayName:crawl.user.displayName, error:err});
//     } else if (!crawl) {
//       done();
//       logger.error('No Crawl with that identifier has been found. (crawler)', {type:'system', crawlId: job.attrs.data.crawlId, userDisplayName:crawl.user.displayName, error:err});
//     }

//     if (crawl.status !== 'progress' || crawl.progress.process < crawl.progress.total) {
//       logger.error('Crawl cannot be finished. (crawler)', {type:'system', crawlId: job.attrs.data.crawlId, userDisplayName:crawl.user.displayName});
//     } else {
//       crawl.status = 'finished';

//       crawl.save(function (err) {
//         if (err) {
//           logger.error('Crawl cannot be saved. (crawler)', {type:'system', crawlId: crawl._id.toString(), error:err});
//           done();
//         }
//         logger.debug('Crawl status updated: status = finished.');

//         // クローラのステータスを更新
//         Crawler.findById(job.attrs.data.crawlerId).populate('user', 'displayName').exec(function (err, crawler) {
//           if (err) {
//             done();
//             logger.error('Cannot be found. (crawler)', {type:'system', crawlerId: job.attrs.data.crawlerId, userDisplayName:crawler.user.displayName, error:err});
//           } else if (!crawler) {
//             done();
//             logger.error('No crawler with that identifier has been found. (crawler)', {type:'system', crawlerId: job.attrs.data.crawlerId, error:err});
//           }

//           Log.aggregate([{
//             $match: {
//               'meta.type': 'crawlResult',
//               'meta.crawlId': job.attrs.data.crawlId
//             }
//           }, {
//             $group: {
//               _id: {
//                 status: '$meta.status'
//               },
//               count: {$sum: 1}
//             }
//           }, {
//             $project: {
//               status: '$_id.status',
//               count: '$count',
//               _id: 0
//             }
//           }], function (err, result) {
//             logger.debug(result);
//             if (err) {
//               done();
//               logger.error('Missing aggregation. (crawler)', {type:'system', crawlerId: job.attrs.data.crawlerId, userDisplayName:crawler.user.displayName, error:err});
//             }
//             else if (!result) {
//               done();
//               logger.error('No Log. (crawler)', {type:'system', crawlerId: job.attrs.data.crawlerId, userDisplayName:crawler.user.displayName, error:err});
//             } else {
//               // クロール結果によりクローラのステータスを変更・保存
//               crawler.status = 'complete';
//               for (var i=0; i<result.length; i++) {
//                 if (result[i].status >= 300) {
//                   crawler.status = 'partial';
//                 }
//               }

//               crawler.save(function (err) {
//                 if (err) {
//                   done();
//                   logger.error('Crawler cannot be saved. (crawler)', {type:'system', crawlerId: job.attrs.data.crawlerId, crawlerName:crawler.name, userDisplayName:crawler.user.displayName, error:err});
//                 }
//                 logger.debug('Crawler status updated: status = '+crawler.status+'.');
//                 logger.info('Finish crawl process.', {
//                   type: 'crawlerInfo',
//                   crawlerName: crawler.name,
//                   record: crawl.record.length
//                 });

//                 done();
//               });
//             }
//           });
//         });

//       });
//     }
//   });
// });

// agenda.on('complete:Closing Crawl', function(job) {
//   job.remove();
// });

