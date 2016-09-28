import { listFormatData } from './data.js';
import {
  CanonicalizeLocaleList,
  GetOption,
  ResolveLocale
} from 'intl/src/9.negotiation.js';
import {
  toObject,
  getInternalProperties,
  Record,
  List,
  arrPush
} from './utils.js';

// http://cldr.unicode.org/development/development-process/design-proposals/list-formatting

function getType({ type }) {
  if (!type) {
    return 'regular';
  }
  if (['regular', 'unit'].indexOf(type) < 0) {
    throw new RangeError('Not a valid type: ' + JSON.stringify(type));
  }
  return type;
}

function getStyle({ style }) {
  if (!style) {
    return 'long';
  }
  if (['long', 'short', 'narrow'].indexOf(style) < 0) {
    throw new RangeError('Not a valid style: ' + JSON.stringify(style));
  }
  return style;
}

// @pattern - 'AA{xx}BB{yy}CC'
// @placeables {xx: 'value1', yy: 'value2'}
//
// returns a list of parts, like:
// [
//   {type: 'literal', value: 'AA'},
//   {type: 'element', value: 'value1'},
//   {type: 'literal', value: 'BB'},
//   {type: 'element', value: 'value2'},
//   {type: 'literal', value: 'CC'}
// ]
function deconstructPattern(pattern, placeables) {
  const parts = pattern.split(/\{([^\}]+)\}/);
  const result = [];

  parts.forEach((part, i) => {
    if (i % 2 === 0) {
      if (part.length > 0) {
        result.push({type: 'literal', value: part});
      }
    } else {
      const subst = placeables[part];
      if (!subst) {
        throw new Error(`Missing placeable: "${part}"`);
      }
      if (Array.isArray(subst)) {
        result.push(...subst);
      } else {
        result.push(subst);
      }
    }
  });
  return result;
}

function CreatePartsFromList(templates, list) {
  if (!Array.isArray(list)) {
    return [];
  }

  const len = list.length;

  if (len === 0) {
    return [];
  }

  if (len === 1) {
    return [
      {type: 'element', value: list[0]}
    ];
  }

  if (len === 2) {
    return deconstructPattern(templates['2'], {
      '0': {type: 'element', value: list[0]},
      '1': {type: 'element', value: list[1]}
    });
  }

  // See: http://cldr.unicode.org/development/development-process/design-proposals/list-formatting
  let parts = {type: 'element', value: list[len - 1]};

  for (let i = len - 2; i > -1; i--) {
    let type =
      i === len - 2 ?
        'end' :
        i === 0 ? 'start' : 'middle';

    parts = deconstructPattern(templates[type], {
      '0': {type: 'element', value: list[i]},
      '1': parts
    });
  }

  return parts;
}

// 1.1.1 InitializeListFormat (listFormat, locales, options)
function InitializeListFormat(listFormat, locales, options) {
    let internal = getInternalProperties(listFormat);

    // 1.1.1.1 If listFormat.[[InitializedIntlObject]] is true, throw a TypeError exception.
    if (internal['[[InitializedIntlObject]]']) {
        throw new TypeError('`this` object has already been initialized as an Intl object');
    }

    // 1.1.1.2 Set listFormat.[[InitializedIntlObject]] to true.
    internal['[[InitializedIntlObject]]'] = true;

    // 1.1.1.3 Let requestedLocales be ? CanonicalizeLocaleList(locales).
    let requestedLocales = CanonicalizeLocaleList(locales);

    // 1.1.1.4 If options is undefined, then
    if (options === undefined) {
        // 1.1.1.4.a Let options be ObjectCreate(%ObjectPrototype%).
        options = {};
    // 1.1.1.5 Else
    } else {
        // 1.1.1.5.a Let options be ToObject(options).
        options = toObject(options);
    }

    // 1.1.1.6 Let opt be a new Record.
    let opt = new Record();

    // 1.1.1.7 Let t be GetOption(options, "type", "string", «"regular", "unit"», "regular").
    let t = GetOption(options, 'type', 'string', new List('regular', 'unit'), 'regular');

    // 1.1.1.8 Set listFormat.[[Type]] to t.
    internal['[[Type]]'] = t;

    // 1.1.1.9 Let s be GetOption(options, "style", "string", «"long", "short", "narrow", "long").
    let s = GetOption(options, 'style', 'string', new List('long', 'short', 'narrow'), 'long');

    // 1.1.1.10 Set listFormat.[[Style]] to s.
    internal['[[Style]]'] = s;

    // 1.1.1.11 Let localeData be %ListFormat%.[[LocaleData]].
    let localeData = ListFormat['[[LocaleData]]'];

    // 1.1.1.12 Let r be ResolveLocale(%ListFormat%.[[AvailableLocales]], requestedLocales, opt, %ListFormat%.[[RelevantExtensionKeys]], localeData).
    let r = ResolveLocale(ListFormat['[[AvailableLocales]]'], requestedLocales, opt, ListFormat['[[RelevantExtensionKeys]]'], localeData);

    // 1.1.1.13 Let dataLocale be r.[[DataLocale]].
    let dataLocale = r['[[DataLocale]]'];

    // 1.1.1.14 Let dataLocaleData be Get(localeData, dataLocale).
    let dataLocaleData = localeData.dataLocale;

    // 1.1.1.15 Let templates be Get(dataLocaleData, t).
    let templates = dataLocaleData.t;

    // 1.1.1.16 Set listFormat.[[Templates]] to be the value of Get(templates, s).
    internal['[[Templates]]'] = templates.s;

    // 1.1.1.17 Set listFormat.[[Locale]] to the value of r.[[Locale]].
    internal['[[Locale]]'] = r['[[Locale]]'];

    // 1.1.1.18 Set listFormat.[[InitializedListFormat]] to true.
    internal['[[InitializedListFormat]]'] = true;

    // 1.1.1.19 Return listFormat.
    return listFormat;
}

// 1.1.2 DeconstructPattern (pattern, placeables)
function DeconstructPattern(pattern, placeables) {
    // 1.1.2.1 Set parts to be the result of pattern.split(/\{([^\}]+)\}/).
    let parts = pattern.split(/\{([^\}]+)\}/);

    // 1.1.2.2 Let result be a new empty List.
    let result = new List();

    // 1.1.2.3 Set i to be 0.
    let i = 0;

    // 1.1.2.4 Repeat, while i < parts.length
    while (i < parts.length) {
        // 1.1.2.4.a Set part to be parts.[i].
        let part = parts[i];

        // 1.1.2.4.b If i % 2 is 0, then
        if (i % 2 === 0) {
            // 1.1.2.4.b.i If part.length is > 0, then
            if (parts.length > 0) {
                // 1.1.2.4.b.i.1 Add new part record { [[Type]]: "literal", [[Value]]: part } as a new element on the list result.
                arrPush.apply(result, new Record({
                    '[[Type]]': 'literal',
                    '[[Value]]': part
                }));
            }
        // 1.1.2.4.c Else
        } else {
            // 1.1.2.4.c.i Set subst to placeables.[[part]].
            let subst = placeables['[[part]]'];
            // 1.1.2.4.c.ii If !subst, then
            if (!subst) {
                // 1.1.2.4.c.ii.1 Throw new Error.
                throw new Error();
            }
            // 1.1.2.4.c.iii If Type(subst) is List, then
            if (subst instanceof List) {
                // 1.1.2.4.c.iii.1 Let len be ? ToLength(? Get(subst, "length")).
                let len = ToLength(subst.length);
            }
        }
    }
}

export default class ListFormat {
  constructor(locales, options) {


    return InitializeListFormat(toObject(this), locales, options);

    this._templates = listFormatData[this.locale][this.type][this.style];
  }

  static supportedLocalesOf(locales, options = {}) {
  }

  resolvedOptions() {
    return {
      locale: this.locale,
      style: this.style
    };
  }

  format(list) {
    return CreatePartsFromList(this._templates, list).reduce(
      (string, part) => string + part.value, '');
  }

  formatToParts(list) {
    return CreatePartsFromList(this._templates, list);
  }
};

/*global ClobberIntlLocale:false */

if (typeof Intl === 'undefined') {
    if (typeof global !== 'undefined') {
        global.Intl = { ListFormat };
    } else if (typeof window !== 'undefined') {
        window.Intl = { ListFormat };
    } else {
        this.Intl = { ListFormat };
    }
} else if (!Intl.ListFormat || (typeof ClobberIntlListFormat !== 'undefined' &&
      ClobberIntlListFormat)) {
    Intl.ListFormat = ListFormat;
} else if (typeof console !== 'undefined') {
    console.warn('Intl.ListFormat already exists, and has NOT been replaced by this polyfill');
    console.log('To force, set a global ClobberIntlListFormat = true');
}
