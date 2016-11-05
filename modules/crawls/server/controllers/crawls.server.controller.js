'use strict';

/**
 * Module dependencies.
 */
var path = require('path'),
  config = require(path.resolve('./config/config')),
  mongoose = require('mongoose'),
  Crawl = mongoose.model('Crawl'),
  Crawler = mongoose.model('Crawler'),
  errorHandler = require(path.resolve('./modules/core/server/controllers/errors.server.controller')),
  logger = require(path.resolve('./modules/core/server/controllers/logger.server.controller')),
  Log = mongoose.model('Log'),
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
      logger.error('Crawl cannot be created.', {type:'system', error:err, user:crawl.user.toObject()});
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
      logger.error('Crawl cannot be updated.', {type:'system', error:err, user:crawl.user.toObject()});
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
            logger.error('Crawl\'s Crawler cannot be updated.', {type:'system', error:err, rawResponse:rawResponse, user:crawl.user.toObject()});
          } else {
            logger.info('Target crawl record have been deleted.', {type:'system', crawlId: crawl._id.toString(), crawlerId: crawl.crawler._id.toString(), user:crawl.user.toObject()});
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
      logger.error('Crawl cannot be listed.', {type:'system', error:err});
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
    crawler: args[0].crawler,
    user: args[0].crawler.user
  });
  
  crawl.save(function (err) {
    if (err) {
      return args[0].res.status(400).send({
        message: errorHandler.getErrorMessage(err)
      });
    }

    args[1](crawl);
  });
};

exports.crawl = function (job, done) {

  Crawl.findById(job.attrs.data.crawlId).exec(function (err, pcrawl) {
    if (err) {
      done(err);
      logger.error('Cannot be found.', {type:'system', crawlerId: job.attrs.data.crawlerId, crawlerName: job.attrs.data.crawlerName, crawlId: job.attrs.data.crawlId, user: job.attrs.data.user, error:err});
    } else if (!pcrawl) {
      done(err);
      logger.error('No Crawl with that identifier has been found.', {type:'system', crawlerId: job.attrs.data.crawlerId, crawlerName: job.attrs.data.crawlerName, crawlId: job.attrs.data.crawlId, userDisplayName: job.attrs.data.userDisplayName});
    }
    
    var resourceRequested = function resourceRequestedFunction(casper, requestData, request) {
      var ig = '\.(gif|jpg|png|svg|swf)\nad-stir\.com\nadap\.tv\nadnxs\.com\nadobedtm\.com\nadtech\.de\nadtechjp\.com\nadtechus\.com\nadvg\.jp\nakamai\.net\namazonaws\.com\nbidswitch\.net\nbrightcove\.co\.jp\nbtstatic\.com\ncasalemedia\.com\ncloudflare\.com\ncloudfront\.com\ncontextweb\.com\ncriteo\.com\ncriteo\.net\ndemdex\.net\ndeqwas\.net\ndoubleclick\.net\nfacebook\.com\nfacebook\.net\nfbcdn\.net\nfout\.jp\ngetpocket\.com\ngoogle-analytics\.com\ngoogle\.co\.jp\ngoogle\.com\ngoogleadservices\.com\ngoogleapis\.com\ngooglesyndication\.com\ngoogletagmanager\.com\ngravatar\.com\ngstatic\.com\nhatena\.ne\.jp\ni-mobile\.net\nimpact-ad\.net\ninstagramfollowbutton\.com\nkaizenplatform\.net\nkeyword-match\.com\nlijit\.com\nmicroad\.jp\nnakanohito\.jp\nomtrdc\.net\nopenx\.net\nptengine\.jp\npubmatic\.com\nrtoaster\.jp\nrubiconproject\.net\nsharethrough\.com\nt\.co\ntaboola\.com\ntapad\.com\nthatsping\.com\nthebrighttag\.com\ntribalfusion\.com\nturn\.com\ntwitter\.com\nverisign\.com\n[a-z]{1,2}[0-9]{1,2}\.yahoo\.co\.jp\nyahooapis\.jp\nyjtag\.jp';
      var skip = ig.split('\n');
      skip.forEach(function(needle) {
        if (new RegExp(needle, 'i').test(requestData.url)) {
          //console.log('Request aborted: '+requestData.url);
          request.abort();
        }
      });
    };
    
    console.log('Spooky running port: '+job.attrs.data.port);
    var spooky = new Spooky({
      child: {
        transport: 'http',
        port: job.attrs.data.port
      },
      casper: {
        logLevel: 'debug',
        onResourceRequested: resourceRequested,
        onWaitTimeout: function () {
          this.exit(0);
        },
        verbose: true,
        pageSettings: {
          userAgent: job.attrs.data.userAgent
        },
        viewportSize: {
          width: job.attrs.data.viewportWidth, 
          height: job.attrs.data.viewportHeight
        }
      }
    }, function (err) {
      if (err) {
        var e = new Error('Failed to initialize SpookyJS');
        e.details = err;
        throw e;
      }
      
      spooky.on('console', function (line) {
        console.log(line);
      });

      spooky.on('debug', function (mess, meta) {
        logger.debug(mess, {meta:meta});
      });

      spooky.on('remote.message', function(msg) {
        logger.debug('[crawler - spooky] Debug / ', {message:msg});
      });
      
      spooky.on('run.complete', function (line) {
        this.removeAllListners();
        this.destroy();
      });

      spooky.on('forward', function(args) {
        // var job = agenda.create('Crawler Crawl', args);
        // job.priority('high');
        // job.save();
        // done();
        crawlers.forward(args);

        this.removeAllListners();
        this.destroy();
      });

      spooky.on('save', function (args) {
        Crawl.findById(args.crawlId).populate('user', 'displayName').populate('crawler').exec(function (err, crawl) {
          if (err) {
            logger.error('Cannot be found. (crawler - spooky)', {
              type:'system',
              crawlId: args.crawlId, 
              crawlerName: crawl.crawler.name,
              crawlerId: crawl.crawler._id.toString(),
              userDisplayName: crawl.user.displayName,
              error:err
            });
          } else if (!crawl || args.rec === null) {
            logger.error('No crawler with that identifier has been found. (crawler - spooky)', {
              type:'system', 
              crawlId: args.crawlId, 
              crawlerId: crawl.crawler._id.toString(),
              crawlerName: crawl.crawler.name,
              userDisplayName: crawl.user.displayName
            });
          }
          
          var error = 0;

          // Save crawl log.
          if (args.rec.length === 0) {
            logger.info('Data not found.', {
              type: 'crawlResult',
              crawlId: args.crawlId, 
              crawlerId: crawl.crawler._id.toString(),
              crawlerName: crawl.crawler.name,
              userDisplayName: crawl.user.displayName,
              url: args.crawlUrl,
              status: 404,
              row: args.rec.length
            });
            error = 1;
          } else {
            var mess;
            if (args.statusCode.toString().indexOf('4') === 0) {
              mess = 'Client error.';
              error = 1;
            }
            else if (args.statusCode.toString().indexOf('5') === 0) {
              mess = 'Server error.';
              error = 1;
            }
            else if (args.statusCode.toString().indexOf('3') === 0) {
              mess = 'Redirection.';
              error = 1;
            }
            else if (args.statusCode.toString().indexOf('2') === 0) {
              mess = 'Success.';
            }
            else {
              mess = 'Undefined status.';
              error = 1;
            }
            logger.info(mess, {
              type: 'crawlResult',
              crawlId: args.crawlId, 
              crawlerId: crawl.crawler._id.toString(),
              crawlerName: crawl.crawler.name,
              userDisplayName: crawl.user.displayName,
              url: args.crawlUrl,
              status: args.statusCode,
              row: args.rec.length
            });
          }

          
          // Adding some special columns.
          for (var i=0; i<args.rec.length; i++) {
            // Generate and add md5 hash.
            var hash = "";
            for (var h=0; h<args.rec[i].length; h++) {
              hash = hash+args.rec[i][h].content;
            }
            args.rec[i].push({name: 'wac@@hash', content: farmhash.fingerprint64(hash)});
          }
          
          // crawl.updated = Date.now();
          // crawl.save(function (err) {
          //   if (err) {
          //     logger.error('Cannot be saved. (crawler - spooky)', {
          //       type:'system', 
          //       crawlId: crawlId, 
          //       crawlerId: crawl.crawler._id.toString(),
          //       crawlerName: crawl.crawler.name,
          //       userDisplayName: crawl.user.displayName,
          //       error:err
          //     });
          //   }
          //   logger.info('Crawl data saved. (crawler - spooky)', {
          //     type:'system', 
          //     crawlId: crawlId, 
          //     crawlerId: crawl.crawler._id.toString(),
          //     crawlerName: crawl.crawler.name,
          //     userDisplayName: crawl.user.displayName
          //   });
          // });
          Crawl.findOneAndUpdate(
            { _id: args.crawlId },
            {
              updated: Date.now(),
              $push: {
                record: {
                  $each: args.rec
                }
              },
              $inc: {
                'progress.process': 1,
                'progress.error': error
              }
            },
            function (err, data) {
              if (err) {
                logger.error('Cannot be saved. (crawler - spooky)', {
                  type:'system', 
                  crawlId: args.crawlId, 
                  crawlerId: crawl.crawler._id.toString(),
                  crawlerName: crawl.crawler.name,
                  userDisplayName: crawl.user.displayName,
                  error:err
                });
              } else {
                logger.info('Crawl data saved. (crawler - spooky)', {
                  type:'system', 
                  crawlId: args.crawlId, 
                  crawlerId: crawl.crawler._id.toString(),
                  crawlerName: crawl.crawler.name,
                  userDisplayName: crawl.user.displayName
                });
              }
            }
          );

          
        });
      });

      spooky.on('process', function () {
        done();
        this.removeAllListners();
        this.destroy();
      });

      
      // Sort by each property's sort no.
      job.attrs.data.props.sort(function(a, b) {
        return (a.sort < b.sort) ? -1 : 1;
      });

      var results = [];

      // Start crawl sequence below.
      spooky.start(job.attrs.data.url);
      

      var jobdata;
      spooky.then([{
        jobdata: job.attrs.data
      }, function retrieve() {
        
        // Capture this page.
        if (jobdata.captureEnabled === true) {
          // everytime override
          this.capture(jobdata.captureSavePath+jobdata.url.substr(jobdata.url.indexOf('://')+3).replace(/\//g, '-')+'.png');
        }
        
        var rrows = [];
        results = this.evaluate(function evaluateStuff(jobdata) {
          var elements;
          var rows = [];

          if (jobdata.basepath !== "") {
            elements =  document.querySelectorAll(jobdata.basepath);
          } else {
            elements = document.querySelectorAll('html');
          }
  
          for (var i=0; i<elements.length; i++) {
            var row = [];
            for (var j=0; j<jobdata.props.length; j++) {
              var cols = [];
              
              if (jobdata.props[j].indexing.multi === false &&
                i >= 1) {
                continue;
              }

              for (var key in jobdata.props[j].matches) {
                var col;
                if (jobdata.props[j].matches[key] === true) {
                  var elem;
                  if (jobdata.props[j].indexing.multi === false) {
                    elem = document.querySelector(jobdata.props[j].path);
                  } else {
                    elem = elements[i].querySelector(jobdata.props[j].path);
                  }
                  if (elem === null) {continue;}
                  if (key === 'src' || key === 'href' || key === 'alt' || key === 'content') {
                    col = elem.getAttribute(key);
                  }
                  if (key === 'text') {
                    // col = elem.innerText;
                    col = elem.innerHTML.replace(/<\/?[^>]+>/igm, "");
                  }
                  if (key === 'html') {
                    col = elem.innerHTML;
                  }

                  if (col !== null) {
                    if (jobdata.props[j].regexp) {
                      var match = col.match(new RegExp(jobdata.props[j].regexp, 'm'));
                      // console.log('match: '+JSON.stringify(match));
                      if (match !== null && match.length >= 3) {
                        col = match[2];
                      }
                      else {
                        col = "";
                      }
                      // col = col.replace(new RegExp(props[j].regexp, 'mg'), '$2');
                    }

                    // console.log('col: '+JSON.stringify(col));

                    var insCol = {
                      att: key, 
                      content: col,
                      // path:jobdata.props[j].path
                    };
                    if (key === 'href') {
                      insCol.noIndex = jobdata.props[j].indexing.no;
                      insCol.deep = jobdata.props[j].deep.enable;
                      insCol.depth = jobdata.props[j].deep.depth;
                      insCol.force = jobdata.props[j].deep.force;
                    }
                    cols.push(insCol);
                  }
                }
              }
      
              for (var n=0; n<cols.length; n++) {
                cols[n].name = jobdata.props[j].name;
                if (cols.length >= 2) {
                  cols[n].name += "@"+cols[n].att;
                }
                row.push(cols[n]);
              }
            }
        
            if (row.length >= 1) {
              // Add crawling url.
              row.push({
                name: 'wac@@url', 
                content: location.href
              });

              rows.push(row);
              console.log('Row: '+JSON.stringify(row));
            }
          }
  
          return rows;
        }, jobdata);

        // console.log('rrows: '+JSON.stringify(rrows));
      }]);
      
      spooky.then([{
        jobdata:job.attrs.data
      }, function () {
        for (var r=0; r<results.length; r++) {
          for (var ir=0; ir<results[r].length; ir++) {
            // Deep indexing
            if (jobdata.type === 'indexer' &&
              results[r][ir].content !== '' && 
              results[r][ir].att === 'href' && 
              results[r][ir].deep === true && 
              jobdata.deep.current < results[r][ir].depth
            ) {
              var forwardData = JSON.parse(JSON.stringify(jobdata));
              forwardData.url = results[r][ir].content;
              forwardData.deep.depth = results[r][ir].depth;
              forwardData.deep.force = results[r][ir].force;
              forwardData.deep.current += 1;
              forwardData.priority = 'high';
              this.emit('forward', forwardData);
            }

            // No-index
            if (results[r][ir].noIndex === true &&
              results[r].length >= 3
            ) {
              results[r].splice(ir, 1);
            }
          }
        }
        // .crawlId, rec, crawlUrl, statusCode
        this.emit('save', {
          crawlId:jobdata.crawlId, 
          rec: results, 
          crawlUrl: jobdata.url, 
          statusCode: this.status().currentHTTPStatus
        });
      }]);

      spooky.then(function () {
        this.emit('process');
      });

      
      // spooky.then([{
      //   jobdata: job.attrs.data
      // }, function forwarding() {
      //   if (jobdata.forwardSelPath !== "" && jobdata.currentPageNum < jobdata.forwardPagesMax) {
      //     var url = this.evaluate(function evaluateStuffForwarding(forwardSelPath) {
      //       var elem;
      //       if (forwardSelPath !== "") {
      //         elem =  document.querySelector(forwardSelPath);
      //       }
      //       if (elem === null) {return false;}
      //       else {return elem.getAttribute('href');}
      //     }, jobdata.forwardSelPath);

      //     if (url) {
      //       this.emit('console', '[crawler - spooky] Forwarding next page... - Current: '+jobdata.currentPageNum+', Max: '+jobdata.forwardPagesMax);
      //       jobdata.currentPageNum = jobdata.currentPageNum + 1;
      //       jobdata.url = url;
      //       this.emit('forward', jobdata);
      //     } else {
      //       this.emit('console','[crawler - spooky] Finishing crawl...');
      //       this.emit('process');
      //     }
      //   } else {
      //     this.emit('console','[crawler - spooky] Finishing crawl...');
      //     this.emit('process');
      //   }
      // }]);
      
      spooky.run();
    });
  });
};
