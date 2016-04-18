'use strict';

/**
 * Module dependencies.
 */
var path = require('path'),
  mongoose = require('mongoose'),
  Crawler = mongoose.model('Crawler'),
  Crawl = mongoose.model('Crawl'),
  errorHandler = require(path.resolve('./modules/core/server/controllers/errors.server.controller')),
  // logger
  logger = require(path.resolve('./modules/core/server/controllers/logger.server.controller')),
  // クロール
  crawls = require(path.resolve('./modules/crawls/server/controllers/crawls.server.controller.js')),
  Property = mongoose.model('Property'),
  kue = require('kue'),
  queue = kue.createQueue({
    disableSearch: false
  }),
  farmhash = require('farmhash'),
  Spooky = require('spooky');

  /*kue.Job.rangeByState( 'complete', 0, 200, 'asc', function( err, jobs ) {
    jobs.forEach( function( job ) {
      job.remove( function(){
        console.log( 'removed ', job.id );
      });
    });
  });
  kue.Job.rangeByState( 'failed', 0, 200, 'asc', function( err, jobs ) {
    jobs.forEach( function( job ) {
      job.remove( function(){
        console.log( 'removed ', job.id );
      });
    });
  });*/
  
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
  crawler.frequency = req.body.frequency;
  crawler.properties = req.body.properties;
  crawler.basepath = req.body.basepath;
  
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
 * crawler middleware
 */
exports.crawlerByID = function (req, res, next, id) {

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).send({
      message: 'Crawler is invalid'
    });
  }

  Crawler.findById(id).populate('user', 'displayName').populate('crawls', 'created').exec(function (err, crawler) {
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



exports.updateCrawlerStatus = function (res, id, crawler_status) {

  Crawler.findById(id).exec(function (err, crawler) {
    if (err) {return res.status(400).send({message: errorHandler.getErrorMessage(err)});
    } else if (!crawler) {return res.status(404).send({message: 'No crawler with that identifier has been found'});
    }
    
    crawler.status = crawler_status;

    crawler.save(function (err) {
      if (err) {return res.status(400).send({message: errorHandler.getErrorMessage(err)});}
      logger.info( '[crawler] Crawler status updated: status = '+crawler_status);
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
  // jobの予約
  var job = queue.create('Crawler Reservation #'+req.crawler._id, {
    title: 'Crawler reserved by "'+req.crawler._id+'"',
    crawler_id: req.crawler._id
  })
  .delay(5000) // ５秒後に実行
  .save( function(err){
    if( !err ) logger.info( '[crawler] Crawler reserved: job.id = '+job.id+' / crawler._id = '+req.crawler._id);
  });
  
  exports.updateCrawlerStatus(res, req.crawler._id, 'reserved');
  
  queue.process('Crawler Reservation #'+req.crawler._id, function(job, done){
    exports.start(req, res, job.data.crawler_id, done);
  });
  
};

exports.now = function (req, res) {
  exports.start(req, res, req.crawler._id, function () {});
  
};

/**
 * start クロール実行
 * strategy設定: 取得するクロール先URLが変化する
 * クロール先URLを取得したらqueueにjob登録する
 */
exports.start = function (req, res, crawler_id, done) {
  logger.debug('[crawler] Starting crawl process.');
  
  // 設定を参照してクロール先URLを取得
  Crawler.findById(crawler_id).populate('user', 'displayName').populate('crawls').exec(function (err, crawler) {
    if (err) {return res.status(500).send({message: 'Error execution: Crawler is not found'});
    } else if (!crawler) {return res.status(404).send({message: 'No crawler with that identifier has been found'});
    }
    logger.debug("[crawler] crawler._id: "+crawler._id);
    
    crawls.start([{res:res, crawler:crawler}, function (crawl) {
      var urls = [];
      var createJobs = function (args) {
        // jobに登録する
        var job;
        var create = function (url, len) {
          job = queue.create('Crawler Crawl #'+crawl._id, {
            title: 'Crawler queued by "'+crawler._id+'"',
            crawler_id: crawler._id,
            props: crawler.properties,
            basepath: crawler.basepath,
            crawl_id: crawl._id,
            url: url,
            len: len
          })
          .ttl(86400)
          .removeOnComplete( true )
          //.searchKeys(['title', 'crawler_id', 'url'])
          .save(function(err){
            if( !err ) {
              logger.info( '[crawler] Job created: job.id = '+job.id+' / crawler._id = '+crawler._id);
            }
          });
        };
  
        for (var i=0; i<args[0].length; i++) {
          create(urls[i], urls.length);
        }
      
        args[1]();
      };
    
      // クロール対象のURLリストを取得してjobを作成
      if (crawler.strategy.selected === 'api') {
        Crawler.findById(crawler.strategy.content.api).populate('crawls', 'record').exec(function (err, apicrawler) {
          if (err) {return res.status(500).send({message: 'Error execution: Crawler is not found'});
          } else if (!apicrawler) {return res.status(404).send({message: 'No crawler with that identifier has been found'});
          }

          for (var u=0; u<apicrawler.crawls[0].record.length; u++) {
            for (var c=0; c<apicrawler.crawls[0].record[u].length; c++) {
              if (apicrawler.crawls[0].record[u][c].name === 'link') {
                urls.push(apicrawler.crawls[0].record[u][c].content);
              }
            }
          }
    
          //logger.debug('URL List: '+urls);
          //createJobs([urls, function () {
          //  done();
          //}]);
          //exports.updateCrawlerStatus(res, req.crawler._id, 'processing'); // Status update
        });
      } else {
        if (crawler.strategy.selected === 'source') {
          urls[0] = crawler.url;
        } else if (crawler.strategy.selected === 'manual') {
          if (crawler.strategy.content.manual === "") {
            urls[0] = crawler.url;
          } else {
            urls = crawler.strategy.content.manual.split('\n');
          }
        }
  
        //logger.debug('URL List: '+urls);
        //createJobs([urls, function () {
        //  done();
        //}]);
        //exports.updateCrawlerStatus(res, req.crawler._id, 'processing'); // Status update
      }
    
      logger.debug('URL List: '+urls);
      createJobs([urls, function () {
        // クロール件数と進捗
        crawler.progress.process = 0;
        crawler.progress.total = urls.length;
        
        // クロール履歴の処理（捨てるか残す）
        if (crawler.archive === "no") {
          crawler.crawls.forEach(function (crawl) {
            //logger.debug('crawl._id: ', crawl._id);
            crawl.remove();
          });
        }
        crawler.crawls.push(crawl);
        crawler.save(function (err) {
          if (err) {return res.status(400).send({message: errorHandler.getErrorMessage(err)});}
          logger.debug("[crawler] crawl._id: "+crawl._id);
  
          done();
          exports.updateCrawlerStatus(res, req.crawler._id, 'processing'); // Status update
          exports.crawl(req, res, crawler_id, crawl._id);
        });
      }]);
    }]);
  });
  
};


exports.crawl = function (req, res, crawler_id, crawl_id) {
  queue.process('Crawler Crawl #'+crawl_id, function ( job, done ) {
    Crawler.findById(crawler_id).exec(function (err, pcrawler) {
      if (err) {
        done(err);
        return res.status(500).send({message: 'Error execution: Crawler'});
      } else if (!pcrawler) {
        done(err);
        return res.status(404).send({message: 'No crawler with that identifier has been found'});
      }

      pcrawler.progress.process = pcrawler.progress.process+1;
      pcrawler.status = "progress";
      
      pcrawler.save(function (err) {
        if (err) {
          done(err);
          this.emit('error', err);
        }
        
        //logger.debug( 'crawling... / '+job.data.url );
        //setTimeout( done, Math.random() * 5000 );
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
            logger.error('[crawler - spooky] Internal error. / ', e);//JSON.stringify(e)
            done(e);
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

          spooky.on('remote.message', function(msg) {
            logger.info('[crawler - spooky] Debugging / ', {message:msg});
          });
    
          spooky.on('save', function (crawl_id, rec) {
            Crawl.findById(crawl_id).populate('user', 'displayName').populate('crawler').exec(function (err, crawl) {
              if (err) {
                spooky.emit('error', err);
              } else if (!crawl || rec === null) {
                spooky.emit('error', err);
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
          
              crawl.save(function (err) {
                if (err) {
                  spooky.emit('error', err);
                }
              });
    
              logger.info('[crawler - spooky] Crawl data saved: crawl_id = '+crawl_id);
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
  
              logger.info('[crawler - spooky] Crawler status updated: status = '+status);
            });
          });
  
          spooky.on('done', function () {
            this.emit('console', 'Done');
            done();
          });
  
          // Sort by each property's sort no.
          job.data.props.sort(function(a, b) {
            return (a.sort < b.sort) ? -1 : 1;
          });
    
    
          // Start crawl sequence below.
          spooky.start(job.data.url);
      
          var props,basepath,crawl_id;
          spooky.then([{
            props: job.data.props,
            basepath: job.data.basepath,
            crawl_id: job.data.crawl_id,
            done: done
          }, function afterStart() {
            //this.emit('console', 'Preparing...');
            //this.emit('debug', 'jobdata', jobdata);
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
    
            this.emit('debug', 'Result - rows: ', rrows);
            this.emit('save', crawl_id, rrows);
          }]);
          
          spooky.then([{
            crawler_id: job.data.crawler_id,
            done: done
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
};

