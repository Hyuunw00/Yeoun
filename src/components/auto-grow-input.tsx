import { useState } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps, type TextStyle } from 'react-native';

// A few points of headroom so rounding never scrolls the first line out of view
const SLACK = 4;

type Props = Omit<TextInputProps, 'multiline' | 'style'> & {
  style?: TextStyle;
  minHeight?: number;
};

// Multiline input that grows with its content inside a ScrollView.
//
// On iOS (new architecture) a multiline input doesn't resize while typing, and
// onContentSizeChange never fires, so its height is computed here instead:
// - an invisible Text with the same text and style counts the wrapped lines
// - two hidden, fixed inputs holding one and two lines measure the input's real line
//   height and padding (the input lays lines out taller than Text does for the same
//   font, so the Text's own height can't be used)
// Keep the input scrollable: with scrollEnabled={false} iOS never draws lines past the
// size it first rendered at, so new lines stay blank even after the input grows.
export function AutoGrowInput({ minHeight = 0, style, value, placeholder, ...props }: Props) {
  const [lines, setLines] = useState(1);
  const [oneLine, setOneLine] = useState(0);
  const [twoLines, setTwoLines] = useState(0);

  const lineHeight = twoLines - oneLine;
  const padding = oneLine - lineHeight;
  const measured = oneLine > 0 && lineHeight > 0 ? padding + lines * lineHeight + SLACK : 0;

  return (
    <View>
      <View
        style={styles.hidden}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants">
        <Text style={style} onTextLayout={(e) => setLines(Math.max(1, e.nativeEvent.lines.length))}>
          {/* Trailing space keeps a final empty line counted after a newline */}
          {(value || placeholder || ' ') + ' '}
        </Text>
        <TextInput
          style={[style, styles.probe]}
          value="가"
          multiline
          editable={false}
          onLayout={(e) => setOneLine(e.nativeEvent.layout.height)}
        />
        <TextInput
          style={[style, styles.probe]}
          value={'가\n가'}
          multiline
          editable={false}
          onLayout={(e) => setTwoLines(e.nativeEvent.layout.height)}
        />
      </View>
      <TextInput
        {...props}
        value={value}
        placeholder={placeholder}
        multiline
        style={[style, { height: Math.max(minHeight, measured) }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hidden: {
    position: 'absolute',
    left: 0,
    right: 0,
    opacity: 0,
  },
  probe: {
    position: 'absolute',
    width: 40,
  },
});
