export default {
  tokenizer: {
    root: [
      [/\/\/.*$/, "comment"],
      [/\/\*/,    "comment", "@block_comment"],

      [/"/,       "string", "@string_double"],
      [/'/,       "string", "@string_single"],
    ],

    block_comment: [
      [/[^\/*]/,  "comment"],
      [/\/\*/,    "comment", "@push"],
      [/\\*\//,   "comment", "@pop"],
      [/[\/*]/,   "comment"]
    ],

    string_double: [
      [/[^\\"]/,  "string"],
      [/\\"/,     "string.escape"],
      [/[\\]/,    "string"],
      [/"/,       "string", "@pop"]
    ],

    string_single: [
      [/[^\\']/,  "string"],
      [/\\'/,     "string.escape"],
      [/[\\]/,    "string"],
      [/'/,       "string", "@pop"]
    ]
  }
};
