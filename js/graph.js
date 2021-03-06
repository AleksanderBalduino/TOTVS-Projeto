(function(root, factory) {
  if (typeof exports === 'object') {
    module.exports = factory(require('jquery'));
  } else if (typeof define === 'function' && define.amd) {
    define('EasyPieChart', ['jquery'], factory);
  } else {
    factory(root.jQuery);
  }
}(this, function($) {

  var CanvasRenderer = function(el, options) {
    var cachedBackground;
    var canvas = document.createElement('canvas');

    if (typeof(G_vmlCanvasManager) !== 'undefined') {
      G_vmlCanvasManager.initElement(canvas);
    }

    var ctx = canvas.getContext('2d');

    canvas.width = canvas.height = options.size;

    el.appendChild(canvas);

    var scaleBy = 1;
    if (window.devicePixelRatio > 1) {
      scaleBy = window.devicePixelRatio;
      canvas.style.width = canvas.style.height = [options.size, 'px'].join('');
      canvas.width = canvas.height = options.size * scaleBy;
      ctx.scale(scaleBy, scaleBy);
    }

    ctx.translate(options.size / 2, options.size / 2);

    ctx.rotate((-1 / 2 + options.rotate / 180) * Math.PI);

    var radius = (options.size - options.lineWidth) / 2;
    if (options.scaleColor && options.scaleLength) {
      radius -= options.scaleLength + 2;
    }

    Date.now = Date.now || function() {
      return +(new Date());
    };

    var drawCircle = function(color, lineWidth, percent) {
      percent = Math.min(Math.max(0, percent || 1), 1);

      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2 * percent, false);

      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;

      ctx.stroke();
    };

    var drawScale = function() {
      var offset;
      var length;
      var i = 24;

      ctx.lineWidth = 1
      ctx.fillStyle = options.scaleColor;

      ctx.save();
      for (var i = 24; i > 0; --i) {
        if (i % 6 === 0) {
          length = options.scaleLength;
          offset = 0;
        } else {
          length = options.scaleLength * .6;
          offset = options.scaleLength - length;
        }
        ctx.fillRect(-options.size / 2 + offset, 0, length, 1);
        ctx.rotate(Math.PI / 12);
      }
      ctx.restore();
    };

    var reqAnimationFrame = (function() {
      return window.requestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        function(callback) {
          window.setTimeout(callback, 1000 / 60);
        };
    }());

    var drawBackground = function() {
      options.scaleColor && drawScale();
      options.trackColor && drawCircle(options.trackColor, options.lineWidth);
    };

    this.clear = function() {
      ctx.clearRect(options.size / -2, options.size / -2, options.size, options.size);
    };

    this.draw = function(percent) {

      if (!!options.scaleColor || !!options.trackColor) {

        if (ctx.getImageData && ctx.putImageData) {
          if (!cachedBackground) {
            drawBackground();
            cachedBackground = ctx.getImageData(0, 0, options.size * scaleBy, options.size * scaleBy);
          } else {
            ctx.putImageData(cachedBackground, 0, 0);
          }
        } else {
          this.clear();
          drawBackground();
        }
      } else {
        this.clear();
      }

      ctx.lineCap = options.lineCap;

      var color;
      if (typeof(options.barColor) === 'function') {
        color = options.barColor(percent);
      } else {
        color = options.barColor;
      }

      if (percent > 100) {
        drawCircle(color, options.lineWidth, percent / 1000);
      } else {
        drawCircle(color, options.lineWidth, percent / 100);

      }
    }.bind(this);

    this.animate = function(from, to) {
      var startTime = Date.now();
      options.onStart(from, to);
      var animation = function() {
        var process = Math.min(Date.now() - startTime, options.animate);
        var currentValue = options.easing(this, process, from, to - from, options.animate);
        this.draw(currentValue);
        options.onStep(from, to, currentValue);
        if (process >= options.animate) {
          options.onStop(from, to);
        } else {
          reqAnimationFrame(animation);
        }
      }.bind(this);

      reqAnimationFrame(animation);
    }.bind(this);
  };

  var EasyPieChart = function(el, opts) {
    var defaultOptions = {
      barColor: '#ff675f',
      trackColor: '#e1e1e3',
      scaleColor: '#e1e1e3',
      scaleLength: 0,
      lineCap: 'round',
      lineWidth: 15,
      size: 152,
      rotate: 0,
      animate: 1000,
      easing: function(x, t, b, c, d) {
        t = t / (d / 2);
        if (t < 1) {
          return c / 2 * t * t + b;
        }
        return -c / 2 * ((--t) * (t - 2) - 1) + b;
      },
      onStart: function(from, to) {
        return;
      },
      onStep: function(from, to, currentValue) {
        return;
      },
      onStop: function(from, to) {
        return;
      }
    };

    if (typeof(CanvasRenderer) !== 'undefined') {
      defaultOptions.renderer = CanvasRenderer;
    } else if (typeof(SVGRenderer) !== 'undefined') {
      defaultOptions.renderer = SVGRenderer;
    } else {
      throw new Error('Please load either the SVG- or the CanvasRenderer');
    }

    var options = {};
    var currentValue = 0;

    var init = function() {
      this.el = el;
      this.options = options;

      for (var i in defaultOptions) {
        if (defaultOptions.hasOwnProperty(i)) {
          options[i] = opts && typeof(opts[i]) !== 'undefined' ? opts[i] : defaultOptions[i];
          if (typeof(options[i]) === 'function') {
            options[i] = options[i].bind(this);
          }
        }
      }

      if (typeof(options.easing) === 'string' && typeof(jQuery) !== 'undefined' && jQuery.isFunction(jQuery.easing[options.easing])) {
        options.easing = jQuery.easing[options.easing];
      } else {
        options.easing = defaultOptions.easing;
      }

      this.renderer = new options.renderer(el, options);

      this.renderer.draw(currentValue);

      if (el.dataset && el.dataset.percent) {
        this.update(parseFloat(el.dataset.percent));
      } else if (el.getAttribute && el.getAttribute('data-percent-2')) {
        this.update(parseFloat(el.getAttribute('data-percent-2')));
      }
    }.bind(this);

    this.update = function(newValue) {
      newValue = parseFloat(newValue);
      if (options.animate) {
        this.renderer.animate(currentValue, newValue);
      } else {
        this.renderer.draw(newValue);
      }
      currentValue = newValue;
      return this;
    }.bind(this);

    init();
  };

  $.fn.easyPieChart = function(options) {
    return this.each(function() {
      if (!$.data(this, 'easyPieChart')) {
        $.data(this, 'easyPieChart', new EasyPieChart(this, options));
      }
    });
  };

}));

$('.graph-donut').easyPieChart({
  easing: 'easeOutBounce',
  barColor: '#7A7A7A',
  rackColor: '#999999',
  scaleColor: '#e1e1e3',
  scaleLength: 0,
  lineCap: 'square',
  lineWidth: 5,
  size: 152,
  onStep: function(from, to, percent) {

    $(this.el).find('.percent-2').text(Math.round(percent));

  }
});