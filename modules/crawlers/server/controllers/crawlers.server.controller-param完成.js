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
  farmhash = require('farmhash'),
  Spooky = require('spooky'),
  agenda = require(path.resolve('./config/lib/agenda.js'));

/**
 * Create a crawler
 * [TODO] properties対応する
 */
exports.create = function (req, res) {
  logger.log(JSON.stringify(req.body), 'notice');
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
  crawler.url = req.body.url;
  crawler.status = req.body.status;
  crawler.archive = req.body.archive;
  crawler.strategy.selected = req.body.strategy.selected;
  crawler.strategy.content = req.body.strategy.content;
  crawler.frequency.selected = req.body.frequency.selected;
  crawler.properties = req.body.properties;
  crawler.basepath = req.body.basepath;
  crawler.filter.source = req.body.filter.source;
  
  JSHINT(crawler.filter.source, {undef: true}, {data: false});
  if (JSHINT.errors.length >= 1) {
    logger.error('JSHINT have been warned JavaScript error.', {crawlerId: crawler._id.toString(), error: JSHINT.errors});
    crawler.filter.errors = JSHINT.errors;
  } else {
    crawler.filter.errors = [];
  }
  
  crawler.save(function (err) {
    if (err) {
      return res.status(400).send({
        message: errorHandler.getErrorMessage(err)
      });
    } else {
      req.crawler = crawler;
      if (req.body.frequency.selected !== 'manual') {
        exports.reserve(req, res);
      }
      else {
        exports.cancelRepeatJob(req, res);
      }
      res.json(crawler);
    }
  });
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
    
    // ここはあとで消す
    /*var sc = 'for (var i=0; i<data.length; i++) {if (data[i].hasOwnProperty("title.href")) {data[i]["title.href"] = "http://www.froma.com"+data[i]["title.href"];}}return data;';
    JSHINT(crawler.filter.source);
    if (JSHINT.errors.length >= 1) {
      logger.error('JSHINT have been warned JavaScript error.', {crawlerId: crawler._id.toString(), error: JSHINT.errors});
      return res.status(500).send({
        message: 'JSHINT have been warned JavaScript error.'
      });
    }*/
    
    if (crawler.filter.source !== "" && crawler.filter.errors.length === 0) {
      JSHINT(crawler.filter.source, {undef: true}, {data: false});
      if (JSHINT.errors.length >= 1) {
        logger.error('JSHINT have been warned JavaScript error.', {crawlerId: crawler._id.toString(), error: JSHINT.errors});
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



exports.updateCrawlerStatus = function (id, crawlerStatus) {

  Crawler.findById(id).exec(function updateCrawlerStatusExec(err, crawler) {
    if (err) {logger.error('[crawler] .Cannot find crawler', {crawlerId: id, error:err});
    } else if (!crawler) {logger.error('No crawler with that identifier has been found', {crawlerId: id});
    }
    
    crawler.status = crawlerStatus;

    crawler.save(function updateCrawlerStatusSave(err) {
      if (err) {logger.error('[crawler] Cannot be saved crawler.', {crawlerId: id});}
      logger.info( '[crawler] Crawler status updated: status = '+crawlerStatus);
    });
  });
};



agenda.on('complete:Crawler Crawl', function(job) {
  job.remove();
});

function strToValueFrequency (str) {
  return str.replace('-', ' ');
}

exports.cancelRepeatJob = function (req, res) {
  agenda.jobs({
    name: 'Crawler Reserve', 'data.crawler_id': req.crawler._id.toString()
  }, function cancelRepeatJobReserveJobs(err, jobs) {
    if (err) {
      logger.error('[crawler] Cannot be canceled any reserved jobs.', {crawlerId: req.crawler._id.toString(), error:err});
    }
    else if (jobs.length === 0) {
      logger.info('[crawler] Should be canceled any reserved jobs are not found.', {crawlerId: req.crawler._id.toString()});
    }
    jobs.forEach (function (job) {
      job.remove(function cancelRepeatJobReserveJobsRemove(err) {
        if (err) {logger.error('Jobs cannot be removed.', {crawlerId: req.crawler._id.toString(), error:err});}
        logger.info('[crawler] Reserved job is removed: crawler_id = ', {crawlerId: req.crawler._id.toString()});
      });
    });
  });
  
  agenda.jobs({
    name: 'Crawler Crawl', 'data.crawler_id': req.crawler._id.toString()
  }, function cancelRepeatJobJobs(err, jobs) {
    if (err) {
      logger.error('[crawler] Cannot be canceled any jobs.', {crawlerId: req.crawler._id.toString(), error:err});
    }
    else if (jobs.length === 0) {
      logger.info('[crawler] Should be canceled any jobs are not found.', {crawlerId: req.crawler._id.toString()});
    }
    jobs.forEach (function (job) {
      job.remove(function cancelRepeatJobJobsRemove(err) {
        if (err) {logger.error('[crawler] Jobs cannot be removed.', {crawlerId: req.crawler._id.toString(), error:err});}
        logger.info('[crawler] Job is removed: crawler_id = ', {crawlerId: req.crawler._id.toString()});
      });
    });
  });
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
  exports.cancelRepeatJob(req, res);
  
  // jobの予約
  var job = agenda.create('Crawler Reserve', {
    crawler_id: req.crawler._id.toString()
  });
  job.schedule('20 seconds');
  job.repeatEvery(strToValueFrequency(req.crawler.frequency.selected));
  job.unique({'data.type': 'active', 'data.crawler_id': req.crawler._id.toString()});
  job.save(function reserveSave(err){
    if (err) {
      logger.error('[crawler] Queue cannot reserve.', {crawlerId: req.crawler._id.toString(), error:err});
    }
    if( !err ) {
      logger.info( 'Job reserved: crawler id = '+req.crawler._id, {crawlerId: req.crawler._id.toString()});
      exports.updateCrawlerStatus(req.crawler._id, 'reserved');
    }
  });
};

agenda.define('Crawler Reserve', {concurrency: 1}, function ( job, done ) {
  exports.start(job.attrs.data.crawler_id, done);
});


exports.now = function (req, res) {
  exports.cancelRepeatJob(req, res);
  exports.start(req.crawler._id, function(){});
};

/**
 * start クロール実行
 * strategy設定: 取得するクロール先URLが変化する
 * クロール先URLを取得したらqueueにjob登録する
 */
exports.start = function (crawlerId, done) {
  logger.debug('[crawler] Starting crawl process.');
  
  // 設定を参照してクロール先URLを取得
  Crawler.findById(crawlerId).populate('user', 'displayName').populate('crawls').exec(function (err, crawler) {
    if (err) {
      done();
      logger.error('[crawler] Cannot be found.', {crawlerId: crawlerId.toString(), error:err});
    } else if (!crawler) {
      done();
      logger.error('[crawler] No crawler with that identifier has been found.', {crawlerId: crawlerId.toString()});
    }
    logger.debug("[crawler] crawler._id: "+crawler._id);
    
    crawls.start([{crawler:crawler}, function (crawl) {
      var urls = [];
      var createJobs = function (urls) {
        logger.debug('URL List: ', urls);
        if (urls.length === 0) {
          logger.error('[crawler] Url list\'s length is 0.', {crawlerId: crawlerId.toString(), crawlId: crawl._id.toString()});
        }
      
        // クロール件数と進捗
        crawler.progress.process = 0;
        crawler.progress.total = urls.length;
      
        // クロール履歴の処理（捨てるか残す）
        if (crawler.archive === "no") {
          crawler.crawls.forEach(function (crawl) {
            crawl.remove();
          });
        }
        crawler.crawls.push(crawl);
        crawler.save(function (err) {
          if (err) {
            logger.error('[crawler] Crawler cannot be saved.', {crawlerId: crawlerId.toString(), crawlId: crawl._id.toString(), error:err});
          }
          logger.debug("[crawler] crawl._id: "+crawl._id);

          done();
          exports.updateCrawlerStatus(crawler._id, 'processing'); // Status update
        
          //urls.forEach(function (url) {
          for (var i=0; i<urls.length; i++) {
            var job = agenda.create('Crawler Crawl', {
              crawler_id: crawler._id.toString(),
              props: crawler.properties.toObject(),
              basepath: crawler.basepath.toString(),
              crawl_id: crawl._id.toString(),
              url: urls[i]
            });
            job.schedule('5 seconds');
            /*job.save(function(err){
              if (err) {
                logger.error('[crawler] Job cannot be create.', {crawlerId: crawlerId.toString(), error:err});
              }
              if( !err ) {
                logger.info( '[crawler] Job created: url = '+urls[i]);
              }
            });*/
            job.save();
          }
          //});
        });
      };
    
      // クロール対象のURLリストを取得してjobを作成
      if (crawler.strategy.selected === 'api') {
        Crawler.findById(crawler.strategy.content.api).populate('crawls', 'record').exec(function (err, apicrawler) {
          if (err) {
            logger.error('[crawler] Cannot be found.', {crawlerId: crawlerId.toString(), crawlId: crawl._id.toString(), error:err});
          } else if (!apicrawler) {
            logger.error('[crawler] No crawler with that identifier has been found.', {crawlerId: crawlerId.toString(), crawlId: crawl._id.toString()});
          }
          
          for (var u=0; u<apicrawler.crawls[0].record.length; u++) {
            for (var c=0; c<apicrawler.crawls[0].record[u].length; c++) {
              if (apicrawler.crawls[0].record[u][c].name === 'link') {
                urls.push(apicrawler.crawls[0].record[u][c].content);
              }
            }
          }
          
          createJobs(urls);
        });
      } else if (crawler.strategy.selected === 'parameter') {

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
            for (var r=params[pos].content.start; r<params[pos].content.end; r++) {
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
        var uri = URI(crawler.url);
        //var pathnames = uri.pathname();
        //var queries = uri.query();
        var params = crawler.strategy.content.parameter;
        var pos = 0;
        var isQuery = false;
        if (params.length >= 1) {
          urls = loopForUrlGenerate(uri.protocol()+'://'+uri.host(), params, pos, isQuery, urls);
        }
        
        createJobs(urls);
      }
      else {
        if (crawler.strategy.selected === 'source') {
          urls[0] = crawler.url;
        } else if (crawler.strategy.selected === 'manual') {
          if (crawler.strategy.content.manual === "") {
            urls[0] = crawler.url;
          } else {
            urls = crawler.strategy.content.manual.split('\n');
          }
        }
        
        createJobs(urls);
      }
    }]);
  });
};

agenda.define('Crawler Crawl', {concurrency: 1}, function ( job, done ) {
  Crawler.findById(job.attrs.data.crawler_id).exec(function (err, pcrawler) {
    if (err) {
      done(err);
      logger.error('[crawler] Cannot be found.', {crawlerId: job.attrs.data.crawler_id, error:err});
    } else if (!pcrawler) {
      done(err);
      logger.error('[crawler] No crawler with that identifier has been found.', {crawlerId: job.attrs.data.crawler_id});
    }

    pcrawler.progress.process = pcrawler.progress.process+1;
    pcrawler.status = "progress";
    
    pcrawler.save(function (err) {
      if (err) {
        done(err);
        this.emit('error', err);
      }
      
      var spooky = new Spooky({
        child: {
          transport: 'http'
        },
        casper: {
          logLevel: 'debug',
          verbose: true
        }
      }, function (err) {
        if (err) {
          var e = new Error('Failed to initialize SpookyJS');
          e.details = err;
          throw e;
        }
  
        spooky.on('error', function (e, stack) {
          console.error(e);
          logger.error('[crawler - spooky] Internal error. / ', {crawlerId: job.attrs.data.crawler_id, error:e});
          done();
          if (stack) { console.log(stack); }
        });

        spooky.on('console', function (line) {
          console.log(line);
        });

        spooky.on('debug', function (mess, meta) {
          logger.debug('[crawler - spooky] '+mess, {meta:meta});
        });

        spooky.on('log', function (log) {
          if (log.space === 'remote') {
            console.log(log.message.replace(/ \- .*/, ''));
          }
        });
        
        spooky.on('crawl.log', function (level, mess, meta) {
          if (level === 'info') {
            logger.info(mess, meta);
          } else if (level === 'error') {
            logger.error(mess, meta);
          }
        });

        spooky.on('remote.message', function(msg) {
          logger.info('[crawler - spooky] Debug / ', {message:msg});
        });
  
        spooky.on('save', function (crawlId, rec, crawlUrl, statusCode) {
          Crawl.findById(crawlId).populate('user', 'displayName').populate('crawler').exec(function (err, crawl) {
            if (err) {
              logger.error('[crawler - spooky] Cannot be found.', {
                crawlId: crawlId, 
                crawlerId: crawl.crawler._id.toString(),
                error:err
              });
            } else if (!crawl || rec === null) {
              logger.error('[crawler - spooky] No crawler with that identifier has been found.', {
                crawlId: crawlId, 
                crawlerId: crawl.crawler._id.toString()
              });
            }
            
            // Save crawl log.
            if (rec.length === 0) {
              logger.error('Data not found.', {
                type: 'crawlLog',
                crawlId: crawlId, 
                crawlerId: crawl.crawler._id.toString(),
                url: crawlUrl,
                status: statusCode,
                row: rec.length
              });
            } else {
              logger.info('Success.', {
                type: 'crawlLog',
                crawlId: crawlId, 
                crawlerId: crawl.crawler._id.toString(),
                url: crawlUrl,
                status: statusCode,
                row: rec.length
              });
            }
            
            // Retrieving last crawled index number and inserting one..
            var lastindex = 0;
            if (crawl.record.length >= 1) {
              //crawl.record.sort(function(a, b) {
              //  return (a['wac@@index'] < b['wac@@index']) ? -1 : 1;
              //});
              for (var r=0; r<crawl.record.length; r++) {
                for (var c=0; c<crawl.record[r].length; c++) {
                  if (crawl.record[r][c].name === 'wac@@index' && crawl.record[r][c].content > lastindex) {
                    lastindex = crawl.record[r][c].content;
                  }
                }
              }
            }
  
            // Adding some special columns.
            for (var i=0; i<rec.length; i++) {
              // Generate and add md5 hash.
              var hash = "";
              for (var h=0; h<rec[i].length; h++) {
                hash = hash+rec[i][h].content;
              }
              rec[i].push({name: 'wac@@hash', content: farmhash.fingerprint64(hash)});
          
              lastindex++;
              rec[i].push({name: 'wac@@index', content: lastindex});
    
              // Merge the new record here.
              crawl.record.push(rec[i]);
            }
            
            crawl.updated = Date.now();
            crawl.save(function (err) {
              if (err) {
                logger.error('[crawler - spooky] Cannot be saved.', {
                  crawlId: crawlId, 
                  crawlerId: crawl.crawler._id.toString(),
                  error:err
                });
              }
              logger.info('[crawler - spooky] Crawl data saved.', {
                  crawlId: crawlId, 
                  crawlerId: crawl.crawler._id.toString()
              });
            });
          });
        });

        spooky.on('update', function (id, status) {
          Crawler.findById(id).exec(function (err, crawler) {
            if (err) {
              spooky.emit('error', err);
            } else if (!crawler) {
              spooky.emit('error', err);
            }

            if (crawler.status === "progress" && crawler.progress.process === crawler.progress.total) {
              crawler.status = "finished";
            }
            else {
              crawler.status = status;
            }
      
            crawler.save(function (err) {
              if (err) {
                spooky.emit('error', err);
              }
            });

            logger.info('[crawler - spooky] Crawler status updated: status = '+status, {crawlerId: id});
          });
        });

        spooky.on('done', function () {
          this.emit('console', 'Done');
          done();
        });

        // Sort by each property's sort no.
        job.attrs.data.props.sort(function(a, b) {
          return (a.sort < b.sort) ? -1 : 1;
        });
  
  
        // Start crawl sequence below.
        spooky.start(job.attrs.data.url);
        //spooky.start();
    
        var props,basepath,crawl_id,crawler_id, crawl_url;
        spooky.then([{
          props: job.attrs.data.props,
          basepath: job.attrs.data.basepath,
          crawl_id: job.attrs.data.crawl_id,
          crawl_url: job.attrs.data.url
        }, function afterStart() {
          var rrows = [];
          rrows = this.evaluate(function evaluateStuffAfterStart(props, basepath) {
            var elements;
            var rows = [];
    
            if (basepath !== "") {
              elements =  document.querySelectorAll(basepath);
            } else {
              elements = document.querySelectorAll('html');
            }
    
            for (var i=0; i<elements.length; i++) {
              var row = [];
              for (var j=0; j<props.length; j++) {
                var cols = [];
                for (var key in props[j].matches) {
                  var col;
                  if (props[j].matches[key] === true) {
                    var elem = elements[i].querySelector(props[j].path);
                    if (elem === null) {continue;}
                    if (key === 'src' || key === 'href' || key === 'alt' || key === 'content') {
                      col = elem.getAttribute(key);
                      if (col !== null) {
                        cols.push({
                          att: key, 
                          con: col,
                          path:props[j].path
                        });
                      }
                    }
                    if (key === 'text') {
                      col = elem.innerText;
                      if (col !== null) {
                        cols.push({
                          att: key, 
                          con: col,
                          path:props[j].path
                        });
                      }
                    }
                  }
                }
        
                // If retrieved content has single attribute.
                if (cols.length === 1) {
                  row.push({name: props[j].name, content: cols[0].con});
                }
                // If retrieved content has multi attributes.
                else if (cols.length >= 2) {
                  for (var n=0; n<cols.length; n++) {
                    row.push({name: props[j].name+"@"+cols[n].att, content: cols[n].con});
                  }
                }
              }
              console.log('row: '+JSON.stringify(row));
          
              if (row.length >= 1) {
                // Add crawling url.
                row.push({name: 'wac@@url', content: location.href});
                rows.push(row);
              }
            }
    
            return rows;
          }, props, basepath);
  
          //this.emit('debug', 'Result - rows: ', rrows);
          this.emit('save', crawl_id, rrows, crawl_url, this.status().currentHTTPStatus);
        }]);
        
        spooky.then([{
          crawler_id: job.attrs.data.crawler_id
        }, function afterSave() {
          this.emit('update', crawler_id, 'progress');
        }]);
        
        spooky.then(function () {
          this.emit('done');
        });
  
        spooky.run();
  
      });
      
    });
  });
});
