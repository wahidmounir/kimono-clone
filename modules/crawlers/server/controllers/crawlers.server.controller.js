'use strict';

/**
 * Module dependencies.
 */
var path = require('path'),
  mongoose = require('mongoose'),
  JSHINT = require('jshint').JSHINT,
  URI = require('urijs'),
  Crawler = mongoose.model('Crawler'),
  Crawl = mongoose.model('Crawl'),
  errorHandler = require(path.resolve('./modules/core/server/controllers/errors.server.controller')),
  // logger
  logger = require(path.resolve('./modules/core/server/controllers/logger.server.controller')),
  // クロール
  crawls = require(path.resolve('./modules/crawls/server/controllers/crawls.server.controller.js')),
  Property = mongoose.model('Property'),
  agenda = require(path.resolve('./config/lib/agenda.js'));

/**
 * Create a crawler
 * [TODO] properties対応する
 */
exports.create = function (req, res) {
  var crawler = new Crawler(req.body);
  crawler.user = req.user;
  
  crawler.save(function (err) {
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
  
  crawler.name = req.body.name;
  
  if (crawler.url !== req.body.url) {
    crawler.strategy.urls = [];
    crawler.strategy.content.parameter = [];
  } else {
    crawler.strategy.content = req.body.strategy.content;
  }
  
  crawler.url = req.body.url;
  crawler.status = req.body.status;
  crawler.archive = req.body.archive;
  crawler.strategy.selected = req.body.strategy.selected;
  crawler.frequency.selected = req.body.frequency.selected;
  crawler.properties = req.body.properties;
  crawler.basepath = req.body.basepath;
  crawler.forwarding = req.body.forwarding;
  crawler.filter.source = req.body.filter.source;
  
  JSHINT(crawler.filter.source, {undef: true}, {data: false});
  if (JSHINT.errors.length >= 1) {
    crawler.filter.errors = JSHINT.errors;
  } else {
    crawler.filter.errors = [];
  }
  
  exports.requestUrlList([{crawler: crawler, user:req.user}, function (urls, err) {
    crawler.strategy.urls = urls;
    
    crawler.save(function (err) {
      if (err) {
        return res.status(400).send({
          message: errorHandler.getErrorMessage(err)
        });
      } else {
        req.crawler = crawler;
        exports.cancelRepeatJob([{req:req}, function () {
          if (req.body.frequency.selected !== 'manual') {
            exports.reserve(req, res);
          }
          res.json(crawler);
        }]);
      }
    });
  }]);
};

exports.updateCrawlerStatus = function (id, crawlerStatus) {

  Crawler.findById(id).populate('user', 'displayName').exec(function updateCrawlerStatusExec(err, crawler) {
    if (err) {logger.error('[crawler] .Cannot find crawler', {crawlerId: id, error:err});
    } else if (!crawler) {logger.error('No crawler with that identifier has been found', {crawlerId: id});
    }
    
    crawler.status = crawlerStatus;

    crawler.save(function updateCrawlerStatusSave(err) {
      if (err) {logger.error('[crawler] Cannot be saved crawler.', {crawlerId: id, userDisplayName:crawler.user.displayName});}
      logger.info( '[crawler] Crawler status updated: status = '+crawlerStatus, {crawlerId: id, userDisplayName:crawler.user.displayName});
    });
  });
};

exports.requestUrlList = function (args) {
  var urls = [];
  if (args[0].crawler.strategy.selected === 'api' && args[0].crawler.strategy.content.api.length >= 1) {
    Crawler.find({"_id": {$in: args[0].crawler.strategy.content.api}}).populate('crawls', 'record').exec(function (err, apicrawler) {
      if (err) {
        logger.error('[crawler] Cannot be found.', {crawlerId: args[0].crawler.strategy.content.api, crawlerName:args[0].crawler.name, error:err});
      } else if (!apicrawler) {
        logger.error('[crawler] No crawler with that identifier has been found.', {crawlerId: args[0].crawler.strategy.content.api, crawlerName:args[0].crawler.name});
      }
      
      for (var a=0; a<apicrawler.length; a++) {
        if (apicrawler[a].crawls.length >= 1) {
          for (var u=0; u<apicrawler[a].crawls[0].record.length; u++) {
            for (var c=0; c<apicrawler[a].crawls[0].record[u].length; c++) {
              if (apicrawler[a].crawls[0].record[u][c].name === 'link') {
                urls.push(apicrawler[a].crawls[0].record[u][c].content);
              }
            }
          }
        }
      }
    
      logger.debug('updateUrlList: ', {urls: urls});
      args[1](urls);
    
    });
  } else if (args[0].crawler.strategy.selected === 'parameter') {
    var loopForUrlGenerate = function (url, params, pos, isQuery, urls) {
      var ls = [];
      var dl = "";
      //logger.debug('param: ', params[pos].toString());
      //logger.debug('paramtype: ', params[pos].paramtype);
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
  } else if (args[0].crawler.strategy.selected === 'source') {
    urls[0] = args[0].crawler.url;
    args[1](urls);
  } else if (args[0].crawler.strategy.selected === 'manual' || args[0].crawler.strategy.selected === 'forward') {
    if (args[0].crawler.strategy.content.manual === "") {
      urls[0] = args[0].crawler.url;
    } else {
      if (args[0].crawler.strategy.content.manual) {
        urls = args[0].crawler.strategy.content.manual.split('\n');
      }
    }
    args[1](urls);
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
  Crawler.find().sort('-created').populate('user', 'displayName').exec(function (err, crawlers) {
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
    var transEachRecord = function (current) {
      //logger.debug('current: ', current);
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
      //logger.debug('r: ', r);
    };
    
    data.name = crawler.name;
    data.created = crawler.created;
    data.status = crawler.status;
    data.rows = [];
    
    if (crawler.crawls.length >= 1) {
      data.lastcrawl = {
        id: crawler.crawls[0]._id,
        date: crawler.crawls[0].updated,
      };
    
      for (var i=0; i<crawler.crawls[0].record.length; i++) {
        var r = {};
        crawler.crawls[0].record[i].forEach(transEachRecord);
        data.rows.push(r);
      }
    }
    
    if (crawler.filter.source !== "" && crawler.filter.errors.length === 0) {
      JSHINT(crawler.filter.source, {undef: true}, {data: false});
      if (JSHINT.errors.length >= 1) {
        logger.error('JSHINT have been warned JavaScript error.', {crawlerId: crawler._id.toString(), crawlerName:crawler.name, user:req.user.toObject(), error: JSHINT.errors});
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

  Crawler.findById(id).populate('user', 'displayName').populate('crawls', 'updated').exec(function (err, crawler) {
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



agenda.on('complete:Crawler Crawl', function(job) {
  job.remove();
});

function strToValueFrequency (str) {
  return str.replace('-', ' ');
}

exports.cancelRepeatJob = function (args) {
  agenda.jobs({
    name: 'Crawler Reserve', 'data.crawler_id': args[0].req.crawler._id.toString()
  }, function cancelRepeatJobReserveJobs(err, jobs) {
    if (err) {
      logger.error('[crawler] Cannot be canceled any reserved jobs.', {crawlerId: args[0].req.crawler._id.toString(), crawlerName:args[0].req.crawler.name, user:args[0].req.crawler.user.toObject(), error:err});
    }
    else if (jobs.length !== 0) {
      logger.info('[crawler] Should be canceled any reserved jobs are not found.', {crawlerId: args[0].req.crawler._id.toString(), crawlerName:args[0].req.crawler.name, user:args[0].req.crawler.user.toObject()});
      jobs.forEach (function (job) {
        job.remove(function cancelRepeatJobReserveJobsRemove(err) {
          if (err) {logger.error('Jobs cannot be removed.', {crawlerId: args[0].req.crawler._id.toString(), crawlerName:args[0].req.crawler.name, user:args[0].req.crawler.user.toObject(), error:err});}
          logger.info('[crawler] Reserved job is removed: crawler_id = ', {crawlerId: args[0].req.crawler._id.toString(), crawlerName:args[0].req.crawler.name, user:args[0].req.crawler.user.toObject()});
        });
      });
    }
    
    agenda.jobs({
      name: 'Crawler Crawl', 'data.crawler_id': args[0].req.crawler._id.toString()
    }, function cancelRepeatJobJobs(err, jobs) {
      if (err) {
        logger.error('[crawler] Cannot be canceled any jobs.', {crawlerId: args[0].req.crawler._id.toString(), crawlerName:args[0].req.crawler.name, user:args[0].req.crawler.user.toObject(), error:err});
      }
      else if (jobs.length !== 0) {
        jobs.forEach (function (job) {
          job.remove(function cancelRepeatJobJobsRemove(err) {
            if (err) {logger.error('[crawler] Jobs cannot be removed.', {crawlerId: args[0].req.crawler._id.toString(), crawlerName:args[0].req.crawler.name, user:args[0].req.crawler.user.toObject(), error:err});}
            logger.info('[crawler] Job is removed: crawler_id = ', {crawlerId: args[0].req.crawler._id.toString(), crawlerName:args[0].req.crawler.name, user:args[0].req.crawler.user.toObject()});
          });
        });
      }
    });
  });
  args[1]();
};

/**
 * reserve - クロールの予約
 * 
 ** できること
 * 実行時間を指定して次回クロールを予約する
 *  - 必要なソースURLの取得などは実行時に取得する
 * [TODO] 同じクローラからのクロール予約可能数は１つのみにする
 * [TODO] 実行時間の指定
 */
exports.reserve = function (req, res) {
  // jobのキャンセル
  exports.cancelRepeatJob([{req:req}, function () {
  
    // jobの予約
    var job = agenda.create('Crawler Reserve', {
      crawler_id: req.crawler._id.toString(),
      crawler_name: req.crawler.name,
      user: req.crawler.user.toObject()
    });
    job.schedule('20 seconds');
    job.repeatEvery(strToValueFrequency(req.crawler.frequency.selected));
    job.unique({'data.type': 'active', 'data.crawler_id': req.crawler._id.toString()});
    job.save(function reserveSave(err){
      if (err) {
        logger.error('[crawler] Queue cannot reserve.', {crawlerId: req.crawler._id.toString(), crawlerName:req.crawler.name, userDisplayName:req.crawler.user.displayName, error:err});
      }
      if( !err ) {
        logger.info( 'Job reserved: crawler id = '+req.crawler._id, {crawlerId: req.crawler._id.toString(), crawlerName:req.crawler.name, userDisplayName:req.crawler.displayName});
        exports.updateCrawlerStatus(req.crawler._id, 'reserved', req.user.toObject());
      }
    });
  }]);
};

agenda.define('Crawler Reserve', {concurrency: 1}, function ( job, done ) {
  exports.start({crawlerId: job.attrs.data.crawler_id}, done);
});


exports.now = function (req, res) {
  exports.cancelRepeatJob([{req:req}, function () {
    exports.start({crawlerId: req.crawler._id.toString()}, function(){});
  }]);
};

/**
 * start クロール実行
 * strategy設定: 取得するクロール先URLが変化する
 * クロール先URLを取得したらqueueにjob登録する
 */
exports.start = function (args, done) {
  var crawlerId = args.crawlerId;
  logger.debug('[crawler] Starting crawl process.');
  
  // 設定を参照してクロール先URLを取得
  Crawler.findById(crawlerId).populate('user', 'displayName').populate('crawls').exec(function (err, crawler) {
    if (err) {
      done();
      logger.error('[crawler] Cannot be found.', {crawlerId: crawlerId, error:err});
    } else if (!crawler) {
      done();
      logger.error('[crawler] No crawler with that identifier has been found.', {crawlerId: crawlerId});
    }
    logger.debug("[crawler] crawler._id: "+crawler._id);
    
    crawls.start([{crawler:crawler}, function (crawl) {
      var createJobs = function (urls) {
        logger.debug('URL List: ', urls);
        if (urls.length === 0) {
          logger.error('[crawler] Url list\'s length is 0.', {crawlerId: crawlerId.toString(), crawlerName:crawler.name, crawlId: crawl._id.toString(), userDisplayName:crawler.user.displayName});
        }
      
        // クロール件数と進捗
        crawler.progress.process = 0;
        crawler.progress.total = urls.length;
      
        // クロール履歴の処理（捨てるか残す）
        if (crawler.archive === "no") {
          crawler.crawls.forEach(function (crawl) {
            crawl.remove();
          });
          crawler.crawls = [];
        }
        crawler.crawls.push(crawl);
        crawler.save(function (err) {
          if (err) {
            logger.error('[crawler] Crawler cannot be saved.', {crawlerId: crawlerId.toString(), crawlerName:crawler.name, crawlId: crawl._id.toString(), userDisplayName:crawler.user.displayName, error:err});
          }
          logger.debug("[crawler] crawl._id: "+crawl._id);

          done();
          exports.updateCrawlerStatus(crawler._id.toString(), 'processing'); // Status update
        
          //urls.forEach(function (url) {
          for (var i=0; i<urls.length; i++) {
            var job = agenda.create('Crawler Crawl', {
              crawler_id: crawler._id.toString(),
              crawlerName:crawler.name,
              props: crawler.properties.toObject(),
              basepath: crawler.basepath.toString(),
              crawl_id: crawl._id.toString(),
              forwardSelPath: crawler.forwarding.path.toString(),
              forwardPagesMax: crawler.forwarding.pages.toString(),
              currentPageNum: 1,
              userDisplayName: crawler.user.displayName,
              url: urls[i]
            });
            job.schedule('5 seconds');
            job.save();
          }
        });
      };
    
      // クロール対象のURLリストを取得してjobを作成
      exports.requestUrlList([{crawler: crawler}, function (urls) {
        createJobs(urls);
      }]);
    }]);
  });
};

agenda.define('Crawler Crawl', {concurrency: 1}, function ( job, done ) {
  console.log('Crawler Crawl');
  crawls.crawl(job,done);
});
