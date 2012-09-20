var VisBranch = Backbone.Model.extend({
  defaults: {
    pos: null
  },

  validateAtInit: function() {
    if (!this.get('branch')) {
      throw new Error('need a branch!');
    }
  },

  initialize: function() {
    this.validateAtInit();
  },

  getPosition: function() {
    var commit = this.get('branch').get('target');
    var visNode = commit.get('visNode');
    var pos = visNode.getScreenCoords();
    return {
      x: pos.x + 30,
      y: pos.y
    };
  },

  genGraphics: function(paper) {
    var pos = this.getPosition();
    if (!paper) {
      console.log('no paper');
      return;
    }
    var name = this.get('branch').get('id');
    var circle = paper.text(pos.x, pos.y, String(name));
    this.set('text', circle);
  },

  animateUpdatedPos: function(paper) {
    var pos = this.getPosition();
    var t = this.get('text');
    if (!t) {
      this.genGraphics(paper);
      t = this.get('text');
      // TODO HACKY
    }
    this.get('text').toFront().stop().animate({
        x: pos.x,
        y: pos.y
      },
      300,
      'easeInOut'
    );
  }
});




var VisNode = Backbone.Model.extend({
  defaults: {
    depth: undefined,
    id: null,
    pos: null,
    radius: null,
    commit: null,
    animationSpeed: GRAPHICS.defaultAnimationTime,
    animationEasing: GRAPHICS.defaultEasing
  },

  validateAtInit: function() {
    if (!this.get('id')) {
      throw new Error('need id for mapping');
    }
    if (!this.get('commit')) {
      throw new Error('need commit for linking');
    }

    if (!this.get('pos')) {
      this.set('pos', {
        x: Math.random(),
        y: Math.random()
      });
    }
  },

  initialize: function() {
    this.validateAtInit();
  },

  setDepthBasedOn: function(depthIncrement) {
    if (this.get('depth') === undefined) {
      throw new Error('no depth yet!');
    }
    var pos = this.get('pos');
    pos.y = this.get('depth') * depthIncrement;
  },

  animateUpdatedPosition: function(speed, easing) {
    var pos = this.getScreenCoords();
    this.get('circle').stop().animate({
        cx: pos.x,
        cy: pos.y
      },
      speed || this.get('animationSpeed'),
      easing || this.get('animationEasing')
    );
  },

  getScreenCoords: function() {
    var pos = this.get('pos');
    return gitVisuals.toScreenCoords(pos);
  },

  getRadius: function() {
    return this.get('radius') || GRAPHICS.nodeRadius;
  },

  genGraphics: function(paper) {
    var pos = this.getScreenCoords();
    var circle = cuteSmallCircle(paper, pos.x, pos.y, {
      radius: this.getRadius()
    });
    this.set('circle', circle);
  }
});

var VisEdge = Backbone.Model.extend({
  defaults: {
    tail: null,
    head: null,
    animationSpeed: GRAPHICS.defaultAnimationTime,
    animationEasing: GRAPHICS.defaultEasing
  },

  validateAtInit: function() {
    required = ['tail', 'head'];
    _.each(required, function(key) {
      if (!this.get(key)) {
        throw new Error(key + ' is required!');
      }
    }, this);
  },

  initialize: function() {
    this.validateAtInit();
  },

  genSmoothBezierPathString: function(tail, head) {
    var tailPos = tail.getScreenCoords();
    var headPos = head.getScreenCoords();
    // we need to generate the path and control points for the bezier. format
    // is M(move abs) C (curve to) (control point 1) (control point 2) (final point)
    // the control points have to be __below__ to get the curve starting off straight.

    var coords = function(pos) {
      return String(Math.round(pos.x)) + ',' + String(Math.round(pos.y));
    };
    var offset = function(pos, dir, delta) {
      delta = delta || GRAPHICS.curveControlPointOffset;
      return {
        x: pos.x,
        y: pos.y + delta * dir
      };
    };
    var offset2d = function(pos, x, y) {
      return {
        x: pos.x + x,
        y: pos.y + y
      };
    };

    // first offset tail and head by radii
    tailPos = offset(tailPos, -1, tail.getRadius());
    headPos = offset(headPos, 1, head.getRadius());

    var str = '';
    // first move to bottom of tail
    str += 'M' + coords(tailPos) + ' ';
    // start bezier
    str += 'C';
    // then control points above tail and below head
    str += coords(offset(tailPos, -1)) + ' ';
    str += coords(offset(headPos, 1)) + ' ';
    // now finish
    str += coords(headPos);

    // arrow head
    // TODO default sizing
    var delta = GRAPHICS.arrowHeadSize || 10;
    str += ' L' + coords(offset2d(headPos, -delta, delta));
    str += ' L' + coords(offset2d(headPos, delta, delta));
    str += ' L' + coords(headPos);

    return str;
  },

  getBezierCurve: function() {
    return this.genSmoothBezierPathString(this.get('tail'), this.get('head'));
  },

  genGraphics: function(paper) {
    var pathString = this.getBezierCurve();
    var path = cutePath(paper, pathString);
    path.toBack();
    this.set('path', path);
  },

  animateUpdatedPath: function(speed, easing) {
    var newPath = this.getBezierCurve();
    this.get('path').toBack();
    this.get('path').stop().animate({
        path: newPath
      },
      speed || this.get('animationSpeed'),
      easing || this.get('animationEasing')
    );
  },

});

var VisEdgeCollection = Backbone.Collection.extend({
  model: VisEdge
});

var VisBranchCollection = Backbone.Collection.extend({
  model: VisBranch
});
