var schedule = require('node-schedule');
var fs = require('fs')

function ClearLog4js (config) {
  this._config= {}
  this._dirPath = ''
  this._jobHandle = null
  this.init(config)
}

var Fn = ClearLog4js.prototype

/* 初始化 */
Fn.init = function (config) {
  config = config || ''
  var type = typeof config
  console.log(type)
  if (type === 'string') {
    var path = config || './config.json'
    // 配置文件路径，支持热重载
    config = this.getConfig(path)
    this.wathConfig(path)
  }
  this._config = config
}

/* 读取文件内容 */
Fn.getConfig = function (path) {
  path = path || './config.json'
  var file = fs.readFileSync(path, {
    encoding: 'utf-8'
  })
  var config = null
  try {
    config = JSON.parse(file)
  } catch (e) {
    config = null
  }
  return config
}

/* 监听配置文件变化 */
Fn.wathConfig = function (path) {
  console.log('监听文件变化start....')
  var that = this
  fs.watchFile(path, function (curr, prev) {
    var config = that.getConfig(path)
    that._config = config
    console.log('文件改变')
    /* 重新配置任务定时器 */
    that.interval()
  });
}

Fn.getLogsFiles = function (dirPath) {
  var path = this._config.logDirPath
  var files = fs.readdirSync(path)
  var filesDate = []
  var that = this
  files.forEach(function (file) {
    /* 去掉隐藏文件 */
    if (file[0] === '.') {
      return
    }

    var states = fs.statSync(path + '/' + file)

    //创建一个对象保存信息
    var obj = new Object();
    obj.size = states.size;//文件大小，以字节为单位
    obj.name = file;//文件名
    obj.path = path + '/' + file; //文件绝对路径
    var dateObj = that.getFileDate(file)
    filesDate.push({
      name: file,
      dateObj: dateObj,
      date: new Date(dateObj.year, (dateObj.month - 1 + 11) % 11, dateObj.day, dateObj.hour, dateObj.seconds),
      status: obj
    })
  })

  /* 按时间排序 */
  filesDate.sort(function (a, b) {
    return b.date - a.date
  })
  console.log(filesDate)
  return filesDate
}

/* 获取文件日期 */
Fn.getFileDate = function (fileName) {
  var dateReg = this._config.dateReg
  var regY = new RegExp(dateReg.year)
  var regM = new RegExp(dateReg.month)
  var regD = new RegExp(dateReg.day)
  var regH = new RegExp(dateReg.hour)
  var regm = new RegExp(dateReg.minute)
  var regS = new RegExp(dateReg.seconds)

  var year = this.getTargetStrByReg(regY, fileName)
  var month = this.getTargetStrByReg(regM, fileName)
  var day = this.getTargetStrByReg(regD, fileName)
  var hour = this.getTargetStrByReg(regH, fileName)
  var minute = this.getTargetStrByReg(regm, fileName)
  var seconds = this.getTargetStrByReg(regS, fileName)

  /* 检测日期合法模式 */
  return {
    year: year,
    month: month,
    day: day,
    hour: hour,
    minute: minute,
    seconds: seconds
  }
}

/* 获取正则表达式匹配的字符串 */
Fn.getTargetStrByReg = function (reg, str) {
  var res = reg.exec(str)
  if (res.length > 1) {
    return parseInt(res[1])
  }
  return 0
}

/* 处理日志文件 */
Fn.rolling = function (files) {
  var logCount = this._config.keepLogCount
  var maxLogSize = this._config.maxLogSize
  var dirPath = this._config.logDirPath
  var deleteFileLogs = []
  /* 数量截取 */
  deleteFileLogs = files.slice(logCount)
  /* 文件大小判断 以后再实现, 暂时只限制文件数量 */
  deleteFileLogs.forEach(function (item) {
    fs.unlink(dirPath + '/' + item.name, function (err) {
      if (!err) {
        console.log(item.name + ' 文件删除成功')
      } else {
        console.log(item.name + ' 文件删除失败', err)
      }
    })
  })
}

/* 任务定时器 */
Fn.interval = function () {
  if (this._jobHandle) {
    this._jobHandle.cancel()
    this._jobHandle = null
  }
  var rule = this._config.interval
  // rule.dayOfWeek = 2;
  // rule.month = 3;
  // rule.dayOfMonth = 1;
  // rule.hour = 1;
  // rule.minute = 42;
  rule.second = 0;
  var that = this
  var j = schedule.scheduleJob(rule, function(){
    /* 日志回滚操作 */
    var files = that.getLogsFiles()
    that.rolling(files)
    /* 日志回滚操作 end */
  });
  this._jobHandle =j
}

new ClearLog4js()
