/**
 * @module DnS
 * @author crossjs <liwenfu@crossjs.com>
 */

'use strict';

var DnS = null;

// 依赖组件
var $ = require('jquery');
var Base = require('nd-base');

var dnsArray = []; // 存储dns instance的数组
var uid = 0; // 标识dns instance的id
var dns = null; // 当前拖放的dns对象
var element = null; // 当前拖放元素
var elementStyle = null; // 当前拖放元素的原始样式
var placeholder = null; // 当前占位元素
var drop = null; // 当前可放置容器  note. drops则为设置的可放置容器
var diffX = 0;
var diffY = 0; // diffX, diffY记录鼠标点击离源节点的距离
var dataTransfer = {}; // 存储拖放信息，在dragstart可设置，在drop中可读取
var dragPre = false; // 标识预拖放
var dragging = false; // 标识是否正在拖放

/*
 * 判断 点(B, C) 是否位于元素 A 内部
 */
function isContain(A, B, C) {
  var offset = $(A).offset();

  // A is document
  if (!offset) {
    offset = {
      left: 0,
      top: 0
    };
  }

  return offset.left <= B &&
    offset.left + $(A).outerWidth() >= B &&
    offset.top <= C &&
    offset.top + $(A).outerHeight() >= C;
}

/*
 * 判断元素 B  相对于于元素 A 的位置
 * 根据元素中心点
 */
function witchPosition(A, B) {
  var offsetA = A.position();

  // A is document
  if (!offsetA) {
    offsetA = {
      left: 0,
      top: 0
    };
  }

  var offsetB = B.position();

  var xb = offsetB.left + B.outerWidth() * 0.5;
  var xa = offsetA.left + A.outerWidth() * 0.5;

  var yb = offsetB.top + B.outerHeight() * 0.5;
  var ya = offsetA.top + A.outerHeight() * 0.5;

  return {
    x: xb === xa ? 0 : xb > xa ? 1 : -1,
    y: yb === ya ? 0 : yb > ya ? 1 : -1
  };
}

/**
 * 保存 element 初始样式
 */
function saveElementStyle() {
  var position = element.position();
  var offset = element.offset();

  elementStyle = {
    position: element.css('position'),
    'z-index': element.css('z-index'),
    left: position.left,
    top: position.top,
    xleft: offset.left,
    xtop: offset.top,
    width: element[0].style.width,
    height: element[0].style.height,
    xwidth: element.css('width'),
    xheight: element.css('height'),
    cursor: element.css('cursor')
  };
}

/*
 * 鼠标按下触发预拖放
 */
function executeDragPre(event) {
  var targetArray = $(event.target).parents().toArray();

  // 查找自身和父元素，判断是否为可拖放元素
  targetArray.unshift(event.target);

  $.each(targetArray, function(index, elem) {
    if ($(elem).data('dns') !== undefined) {
      dns = $(elem).data('dns');

      if (!isNaN(dns)) {
        dns = dnsArray[dns];
        element = $(elem);
      } else if (dns === true) {
        dns = new DnS(elem, $(elem).data('config'));
        element = $(elem);
      } else if (dns === false) {

        // dns为false标识禁止该元素触发拖放
        dns = null;
      } else {

        // 继续向上寻找
        return true;
      }
      return false;
    }
  });

  // 不允许拖放则返回
  if (dns === null || dns.get('disabled') === true) {
    return;
  }

  if (dns.get('canDrag').call(dns, event.target) === false) {
    return;
  }

  saveElementStyle();

  if (placeholder) {
    placeholder.remove();
  }

  placeholder = dns.get('placeholder');

  // 初始化 placeholder
  if (placeholder === null) {
    placeholder = element.clone().css('visibility', 'hidden').insertAfter(element);
  }

  // 记录鼠标点击位置与源节点 element 的距离
  diffX = event.pageX - elementStyle.xleft;
  diffY = event.pageY - elementStyle.xtop;

  element.css({
    position: 'absolute',
    left: elementStyle.left,
    top: elementStyle.top,
    width: elementStyle.xwidth,
    height: elementStyle.xheight
  });

  dragPre = true;
}

/*
 * 鼠标拖动触发拖放
 */
function executeDragStart() {
  var dragCursor = dns.get('dragCursor');
  var zIndex = dns.get('zIndex');

  // 显示 element
  element.css({
    'z-index': zIndex,
    cursor: dragCursor
  }).focus();

  dataTransfer = {};
  dragPre = false;
  dragging = true;
  dns.trigger('dragstart', dataTransfer, element);
}

/*
 * 根据边界和方向一起判断是否drag并执行
 */
function executeDrag(event) {
  var axis = dns.get('axis');
  var xleft = event.pageX - diffX;
  var xtop = event.pageY - diffY;
  var originx = elementStyle.xleft - elementStyle.left;
  var originy = elementStyle.xtop - elementStyle.top;
  var containment = dns.get('containment');
  var offsetC = containment.offset();

  // containment is document
  // 不用 === 是因为 jquery 版本不同，返回值也不同
  if (!offsetC) {
    offsetC = {
      left: 0,
      top: 0
    };
  }

  offsetC.left += containment.scrollLeft();
  offsetC.top += containment.scrollTop();

  // 是否在x方向上移动并执行
  if (axis !== 'y') {
    if (xleft >= offsetC.left &&
      xleft + element.outerWidth() <= offsetC.left +
      containment.outerWidth()) {
      element.css('left', xleft - originx);
    } else {
      if (xleft <= offsetC.left) {
        element.css('left', offsetC.left - originx);
      } else {
        element.css('left',
          offsetC.left + containment.outerWidth() -
          element.outerWidth() - originx);
      }
    }
  }

  // 是否在y方向上移动并执行
  if (axis !== 'x') {
    if (xtop >= offsetC.top &&
      xtop + element.outerHeight() <= offsetC.top +
      containment.outerHeight()) {
      element.css('top', xtop - originy);
    } else {
      if (xtop <= offsetC.top) {
        element.css('top', offsetC.top - originy);
      } else {
        element.css('top',
          offsetC.top + containment.outerHeight() -
          element.outerHeight() - originy);
      }
    }
  }

  dns.trigger('drag', element, drop);
}

/*
 * 根据 element 和可放置容器的相互位置来判断是否 dragenter,
 * dragleave 和 dragover并执行
 */
function executeDragEnterLeaveOver() {
  var drops = dns.get('drops');

  if (drops === null) {
    return;
  }

  var offset = element.offset();

  var xleft = offset.left + diffX;
  var xtop = offset.top + diffY;

  var dropCursor = dns.get('dropCursor');
  var activeDrop;

  if (placeholder) {
    if (isContain(placeholder, xleft, xtop) === true) {
      if (drop !== placeholder) {
        drop = activeDrop = placeholder;
      } else {
        return dns.trigger('dragover', element, drop);
      }
    }
  }

  if (!activeDrop) {
    $.each(drops, function(index, elem) {
      if (!element.is(elem) && isContain(elem, xleft, xtop) === true) {
        element.css('cursor', dropCursor).focus();

        if (!drop || drop[0] !== elem) {
          activeDrop = $(elem);
        }

        return false; // 跳出each
      }
    });

    // changed
    if (activeDrop) {
      if (drop) {
        dns.trigger('dragleave', element, drop);
      }

      drop = activeDrop;
      dns.trigger('dragenter', element, drop);

      return;
    }
  }

  function handlePlaceholder() {
    var axis = dns.get('axis');
    var position = witchPosition(drop, element);
    var action;

    if (axis === 'x') {
      if (position.x === -1) {
        action = 'insertBefore';
      } else if (position.x === 1) {
        action = 'insertAfter';
      }
    } else if (axis === 'y') {
      if (position.y === -1) {
        action = 'insertBefore';
      } else if (position.y === 1) {
        action = 'insertAfter';
      }
    } else {
      if (position.x === -1 && position.y === -1) {
        action = 'insertBefore';
      } else if (position.x === 1 && position.y === -1) {
        action = 'insertAfter';
      }
    }

    if (action) {
      placeholder[action](drop);
    }
  }

  // no change
  if (drop) {
    var dragCursor = dns.get('dragCursor');

    if (isContain(drop, xleft, xtop) === false) {

      element.css('cursor', dragCursor).focus();

      dns.trigger('dragleave', element, drop);
      drop = null;
    } else {

      if (drop !== placeholder) {
        handlePlaceholder();
      } else {
        dns.trigger('dragover', element, drop);
      }
    }
  }
}

/*
 * 根据proxy和当前的可放置容器地相互位置判断是否drop并执行
 * 当proxy不完全在drop内且不需要revert时, 将proxy置于drop中央
 */
function executeDrop() {
  if (drop === null) {
    return;
  }

  dns.trigger('drop', dataTransfer, element, drop);
}

/*
 * 根据revert判断是否要返回并执行
 * 若可放置容器drops不为null且当前可放置容器drop为null, 则自动回到原处
 * 处理完移除代理元素
 */
function executeRevert() {
  if (drop) {
    element.insertAfter(placeholder);
  }

  element.css(elementStyle);
  element = null;
  elementStyle = null;
  placeholder.remove();
  placeholder = null;

  dns.trigger('dragend', element, drop);

  dns = null;
  drop = null;
}

/*
 * 核心部分, 处理鼠标按下、移动、释放事件, 实现拖放逻辑
 */
function handleEvent(event) {
  switch (event.type) {
    case 'mousedown':
      if (event.which === 1) {

        // 检测并执行预拖放
        executeDragPre({
          target: event.target,
          pageX: event.pageX,
          pageY: event.pageY
        });

        // 阻止默认选中文本
        if (dragPre === true) {
          event.preventDefault();
        }
      }
      break;

    case 'mousemove':
      if (dragPre === true) {

        // 开始拖放
        executeDragStart();
      } else if (dragging === true) {

        // 根据边界和方向一起判断是否drag并执行
        executeDrag({
          pageX: event.pageX,
          pageY: event.pageY
        });

        // 根据 element 和可放置容器的相互位置来判断
        // 是否要dragenter, dragleave和dragover并执行
        executeDragEnterLeaveOver();

        // 阻止默认选中文本
        event.preventDefault();
      }
      break;

    case 'mouseup':
      // 点击而非拖放时
      if (dragPre === true) {
        element.css(elementStyle);
        element = null;
        placeholder.remove();
        placeholder = null;
        dns = null;
        dragPre = false;
      } else if (dragging === true) {
        dragging = false;

        element.css('cursor', 'default').focus();

        // 根据当前的可放置容器判断是否drop并执行
        executeDrop();

        // 根据revert属性判断是否要返回并执行
        executeRevert();
      }
      break;
  }
}

DnS = Base.extend({
  attrs: {
    elements: {
      value: null,
      readOnly: true
    },
    containment: {
      value: document,
      setter: function(val) {
        return $(val).eq(0);
      }
    },
    proxy: {
      value: null,
      setter: function(val) {
        return $(val).eq(0);
      }
    },
    placeholder: {
      value: null,
      setter: function(val) {
        return $(val).eq(0);
      }
    },
    drops: {
      value: null,
      setter: function(val) {
        // 反转顺序，先匹配最深的
        return $(val).toArray().reverse();
      }
    },
    disabled: false,
    axis: false,
    dragCursor: 'move',
    dropCursor: 'copy',
    zIndex: 9999,
    canDrag: function(/*elem*/) {
      return true;
    }
  },

  initialize: function(config) {
    DnS.superclass.initialize.call(this, config);

    this.uid = uid;
    dnsArray[uid++] = this;

    this.addElement();
  },

  addElement: function(elem) {
    if (!elem) {
      elem = this.get('elements');
    }

    if (elem) {
      // 在源节点上存储dns uid
      $(elem).data('dns', this.uid);
    }
  }
});

/*
 * 开启页面DnS功能，绑定鼠标按下、移动、释放事件
 */
DnS.open = function() {
  $(document).on('mousedown mousemove mouseup', handleEvent);
};

/*
 * 关闭页面DnS功能，解绑鼠标按下、移动、释放事件
 */
DnS.close = function() {
  $(document).off('mousedown mousemove mouseup', handleEvent);
};

// 默认关闭
// DnS.open();

module.exports = DnS;
