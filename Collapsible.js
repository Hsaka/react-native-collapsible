import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Animated, Easing } from 'react-native';
import { ViewPropTypes } from './config';

const ANIMATED_EASING_PREFIXES = ['easeInOut', 'easeOut', 'easeIn'];

export default class Collapsible extends Component {
  static propTypes = {
    align: PropTypes.oneOf(['top', 'center', 'bottom']),
    collapsed: PropTypes.bool,
    collapsedHeight: PropTypes.number,
    duration: PropTypes.number,
    easing: PropTypes.oneOfType([PropTypes.string, PropTypes.func]),
    style: ViewPropTypes.style,
    children: PropTypes.node
  };

  static defaultProps = {
    align: 'top',
    collapsed: true,
    collapsedHeight: 0,
    duration: 300,
    easing: 'easeOutCubic'
  };

  constructor(props) {
    super(props);
    this.state = {
      measuring: false,
      measured: false,
      height: new Animated.Value(props.collapsedHeight),
      contentHeight: 0,
      contentY: 0,
      selfClosed: false,
      animating: false
    };
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    if (nextProps.collapsed !== this.props.collapsed) {
      this._toggleCollapsed(
        nextProps.collapsed,
        nextProps.selfClosed,
        nextProps.index,
        nextProps.activeIndex
      );
    } else if (
      nextProps.collapsed &&
      nextProps.collapsedHeight !== this.props.collapsedHeight
    ) {
      this.state.height.setValue(nextProps.collapsedHeight);
    }
  }

  contentHandle = null;

  _handleRef = ref => {
    this.contentHandle = ref;
  };

  _measureContent(callback) {
    this.setState(
      {
        measuring: true
      },
      () => {
        requestAnimationFrame(() => {
          if (!this.contentHandle) {
            this.setState(
              {
                measuring: false
              },
              () => callback(this.props.collapsedHeight)
            );
          } else {
            this.contentHandle
              .getNode()
              .measure((x, y, width, height, px, py) => {
                this.setState(
                  {
                    measuring: false,
                    measured: true,
                    contentHeight: height,
                    contentY: py
                  },
                  () => callback({ height: height, y: py })
                );
              });
          }
        });
      }
    );
  }

  _toggleCollapsed(collapsed, selfClosed, index, activeIndex) {
    if (collapsed) {
      //this._transitionToHeight(this.props.collapsedHeight);

      if (
        !selfClosed &&
        activeIndex >= index &&
        this.props.parent &&
        this.props.parent._scrollview
        //this.props.parent._scrollview._ypos - this.state.contentHeight > 0
      ) {
        this.props.parent._scrollview.scrollToPosition(
          0,
          Math.abs(
            this.props.parent._scrollview._ypos - this.state.contentHeight
          ),
          false
        );
      }

      this.state.height.setValue(this.props.collapsedHeight);
    } else if (!this.contentHandle) {
      if (this.state.measured) {
        // this._transitionToHeight(this.state.contentHeight);
        this.state.height.setValue(this.state.contentHeight);
      }
      return;
    } else {
      this._measureContent(content => {
        // this._transitionToHeight(content.height);
        this.state.height.setValue(this.state.contentHeight);
      });
    }
  }

  _transitionToHeight(height) {
    const { duration } = this.props;
    let easing = this.props.easing;
    if (typeof easing === 'string') {
      let prefix;
      let found = false;
      for (let i = 0; i < ANIMATED_EASING_PREFIXES.length; i++) {
        prefix = ANIMATED_EASING_PREFIXES[i];
        if (easing.substr(0, prefix.length) === prefix) {
          easing =
            easing.substr(prefix.length, 1).toLowerCase() +
            easing.substr(prefix.length + 1);
          prefix = prefix.substr(4, 1).toLowerCase() + prefix.substr(5);
          easing = Easing[prefix](Easing[easing || 'ease']);
          found = true;
          break;
        }
      }
      if (!found) {
        easing = Easing[easing];
      }
      if (!easing) {
        throw new Error('Invalid easing type "' + this.props.easing + '"');
      }
    }

    if (this._animation) {
      this._animation.stop();
    }
    this.setState({ animating: true });
    this._animation = Animated.timing(this.state.height, {
      toValue: height,
      duration,
      easing
    }).start(() => this.setState({ animating: false }));
  }

  _handleLayoutChange = event => {
    const contentHeight = event.nativeEvent.layout.height;
    if (
      this.state.animating ||
      this.props.collapsed ||
      this.state.measuring ||
      this.state.contentHeight === contentHeight
    ) {
      return;
    }
    this.state.height.setValue(contentHeight);
    this.setState({ contentHeight });
  };

  render() {
    const { collapsed } = this.props;
    const { height, contentHeight, measuring, measured } = this.state;
    const hasKnownHeight = !measuring && (measured || collapsed);
    const style = hasKnownHeight && {
      overflow: 'hidden',
      height: height
    };

    const contentStyle = {};
    if (measuring) {
      contentStyle.position = 'absolute';
      contentStyle.opacity = 0;
    } else if (this.props.align === 'center') {
      contentStyle.transform = [
        {
          translateY: height.interpolate({
            inputRange: [0, contentHeight],
            outputRange: [contentHeight / -2, 0]
          })
        }
      ];
    } else if (this.props.align === 'bottom') {
      contentStyle.transform = [
        {
          translateY: height.interpolate({
            inputRange: [0, contentHeight],
            outputRange: [-contentHeight, 0]
          })
        }
      ];
    }

    return (
      <Animated.View style={style} pointerEvents={collapsed ? 'none' : 'auto'}>
        <Animated.View
          ref={this._handleRef}
          style={[this.props.style, contentStyle]}
          onLayout={this.state.animating ? undefined : this._handleLayoutChange}
        >
          {this.props.children}
        </Animated.View>
      </Animated.View>
    );
  }
}
