'use strict';

/**
 * Module dependencies.
 */
var path = require('path'),
  mongoose = require('mongoose'),
  Crawl = mongoose.model('Crawl'),
  Crawler = mongoose.model('Crawler'),
  errorHandler = require(path.resolve('./modules/core/server/controllers/errors.server.controller')),
  logger = require(path.resolve('./modules/core/server/controllers/logger.server.controller')),
  crawlers = require(path.resolve('./modules/crawlers/server/controllers/crawlers.server.controller')),
  farmhash = require('farmhash'),
  Spooky = require('spooky'),
  agenda = require(path.resolve('./config/lib/agenda.js'));

/**
 * Create a crawl
 */
exports.create = function (req, res) {
  Crawl.schema.add({
    record: [{
      property_name: String
    }]
  });
  
  var crawl = new Crawl({
    status: 'none',
    record: []
  });
  
  crawl.save(function (err) {
    if (err) {
      return res.status(400).send({
        message: errorHandler.getErrorMessage(err)
      });
    }
  });
  
  res.json(crawl);
};

/**
 * Show the current crawl
 */
exports.read = function (req, res) {
  res.json(req.crawl);
};

/**
 * Update a crawl
 */
exports.update = function (req, res) {
  var crawl = req.crawl;

  crawl.status = req.body.status;

  crawl.save(function (err) {
    if (err) {
      return res.status(400).send({
        message: errorHandler.getErrorMessage(err)
      });
    } else {
      res.json(crawl);
    }
  });
};

/**
 * Delete an crawl
 */
exports.delete = function (req, res) {
  var crawl = req.crawl;

  crawl.remove(function (err) {
    if (err) {
      return res.status(400).send({
        message: errorHandler.getErrorMessage(err)
      });
    } else {
      crawl.crawler.update(
        {$pull: {crawls: crawl._id}},
        {safe: true},
        function (err, rawResponse) {
          if (err) {
            logger.error('Crawl\'s Crawler cannot be updated.', {error:err, rawResponse:rawResponse});
          } else {
            logger.info('Target crawl record have been deleted.', {crawlId: crawl._id.toString(), crawlerId: crawl.crawler._id.toString()});
            res.json(crawl);
          }
        }
      );
    }
  });
};

/**
 * List of crawls
 */
exports.list = function (req, res) {
  Crawl.find().sort('-created').populate('user', 'displayName').exec(function (err, crawls) {
    if (err) {
      return res.status(400).send({
        message: errorHandler.getErrorMessage(err)
      });
    } else {
      res.json(crawls);
    }
  });
};

/**
 * crawl middleware
 */
exports.crawlByID = function (req, res, next, id) {

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).send({
      message: 'Crawl is invalid'
    });
  }

  Crawl.findById(id).populate('user', 'displayName').populate('crawler').populate('user', 'displayName').exec(function (err, crawl) {
    if (err) {
      return next(err);
    } else if (!crawl) {
      return res.status(404).send({
        message: 'No crawl with that identifier has been found'
      });
    }
    req.crawl = crawl;
    next();
  });
};

/**
 * start
 */
exports.start = function (args) {
  var crawl = new Crawl({
    status: 'none',
    crawler: args[0].crawler,
    user: args[0].crawler.user
  });
  
  crawl.save(function (err) {
    if (err) {
      return args[0].res.status(400).send({
        message: errorHandler.getErrorMessage(err)
      });
    }
  });
  
  args[1](crawl);
};

exports.crawl = function (job, done) {
  Crawler.findById(job.attrs.data.crawler_id).exec(function (err, pcrawler) {
    if (err) {
      done(err);
      logger.error('[crawler] Cannot be found.', {crawlerId: job.attrs.data.crawler_id, error:err});
    } else if (!pcrawler) {
      done(err);
      logger.error('[crawler] No crawler with that identifier has been found.', {crawlerId: job.attrs.data.crawler_id});
    }

    pcrawler.status = "progress";
    
    pcrawler.save(function (err) {
      if (err) {
        done(err);
        logger.error('[crawler] Cannot be saved', err);
      }
      
      var resourceRequested = function (casper, requestData, request) {
        // google\.co\.jp\ngoogle\.com\n
        var ig = '\.(css|gif|jpg|png|svg|swf)\nad-stir\.com\nadap\.tv\nadnxs\.com\nadobedtm\.com\nadtech\.de\nadtechjp\.com\nadtechus\.com\nadvg\.jp\nakamai\.net\namazonaws\.com\nbidswitch\.net\nbrightcove\.co\.jp\nbtstatic\.com\ncasalemedia\.com\ncloudflare\.com\ncloudfront\.com\ncontextweb\.com\ncriteo\.com\ncriteo\.net\ndemdex\.net\ndeqwas\.net\ndoubleclick\.net\nfacebook\.com\nfacebook\.net\nfbcdn\.net\nfout\.jp\ngetpocket\.com\ngoogle-analytics\.com\ngoogleadservices\.com\ngoogleapis\.com\ngooglesyndication\.com\ngoogletagmanager\.com\ngravatar\.com\ngstatic\.com\nhatena\.ne\.jp\ni-mobile\.net\nimpact-ad\.net\ninstagramfollowbutton\.com\nkaizenplatform\.net\nkeyword-match\.com\nlijit\.com\nmicroad\.jp\nnakanohito\.jp\nomtrdc\.net\nopenx\.net\nptengine\.jp\npubmatic\.com\nrtoaster\.jp\nrubiconproject\.net\nsharethrough\.com\nt\.co\ntaboola\.com\ntapad\.com\nthatsping\.com\nthebrighttag\.com\ntribalfusion\.com\nturn\.com\ntwitter\.com\nverisign\.com\n[a-z]{1,2}[0-9]{1,2}\.yahoo\.co\.jp\nyahooapis\.jp\nyimg\.jp\nyjtag\.jp';
        var skip = ig.split('\n');
        skip.forEach(function(needle) {
          if (new RegExp(needle, 'i').test(requestData.url)) {
            console.log('Request aborted: '+requestData.url);
            request.abort();
          }
        });
      };
      
      var spooky = new Spooky({
        child: {
          transport: 'http'
        },
        casper: {
          logLevel: 'debug',
          onResourceRequested: resourceRequested,
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
          logger.debug(mess, {meta:meta});
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
          logger.debug('[crawler - spooky] Debug / ', {message:msg});
        });
  
        spooky.on('forward', function(args) {
          var job = agenda.create('Crawler Crawl', {
            crawler_id: args.crawler_id,
            props: args.props,
            basepath: args.basepath,
            crawl_id: args.crawl_id,
            forwardSelPath: args.forwardSelPath,
            forwardPagesMax: args.forwardPagesMax,
            currentPageNum: args.currentPageNum,
            url: args.url
          });
          logger.info('[crawler - spooky] Forwarding next page...');
          job.save();
          done();
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

            if (crawler.status === "progress" && crawler.progress.process >= crawler.progress.total) {
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

        spooky.on('process', function () {
          pcrawler.progress.process = pcrawler.progress.process+1;
          pcrawler.save(function (err) {
            if (err) {
              done(err);
              logger.error('[crawler] Cannot be saved', err);
            }
          });
          this.emit('console', 'Done');
          done();
          //this.destroy();
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
              console.log('Row: '+JSON.stringify(row));
          
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
        
        var forwardSelPath, forwardPagesMax, currentPageNum;
        spooky.then([{
          props: job.attrs.data.props,
          basepath: job.attrs.data.basepath,
          crawler_id: job.attrs.data.crawler_id,
          crawl_id: job.attrs.data.crawl_id,
          crawl_url: job.attrs.data.url,
          forwardSelPath: job.attrs.data.forwardSelPath,
          forwardPagesMax: job.attrs.data.forwardPagesMax,
          currentPageNum: job.attrs.data.currentPageNum
        }, function forwarding() {
          var url = "";
          var elem = "";
          if (forwardSelPath !== "" && currentPageNum < forwardPagesMax) {
            url = this.evaluate(function evaluateStuffForwarding(forwardSelPath) {
              if (forwardSelPath !== "") {
                elem =  document.querySelector(forwardSelPath);
              }
              if (elem === null) {return false;}
              else {return elem.getAttribute('href');}
            }, forwardSelPath);
            if (url) {
              currentPageNum = currentPageNum + 1;
              this.emit('forward', {
                props: props,
                basepath: basepath,
                crawler_id: crawler_id,
                crawl_id: crawl_id,
                forwardSelPath: forwardSelPath,
                forwardPagesMax: forwardPagesMax,
                currentPageNum: currentPageNum,
                url: url
              });
            } else {
              this.emit('debug','finishing crawl...', {current: currentPageNum, max:forwardPagesMax});
              this.emit('process');
            }
          } else {
            this.emit('debug','finishing crawl...', {current: currentPageNum, max:forwardPagesMax});
            this.emit('process');
          }
        }]);
        
        spooky.then([{
          crawler_id: job.attrs.data.crawler_id
        }, function afterSave() {
          this.emit('update', crawler_id, 'progress');
        }]);
        
        spooky.run();
  
      });
      
    });
  });
};

