/* Small demo family (made-up) so you can see how the tree grows. */
(function (root) {
  'use strict';
  // [name, index of parent in this list or -1 for a root]
  var rows = [
    ['જીવરાજભાઈ', -1],      // 0
    ['અક્ષય', 0],           // 1
    ['મનન', 0],             // 2
    ['યશ', 0],              // 3
    ['ભાવેશ', 1],           // 4
    ['પ્રવીણ', 1],          // 5
    ['કીર્તિ', 2],          // 6
    ['ભવિન', 3],            // 7
    ['આરવ', 3],             // 8
    ['અંકિત', 4],           // 9
    ['હર્ષ', 4],            // 10
    ['દીપ', 6],             // 11
    ['નીલ', 6],             // 12
    ['રાજ', 6],             // 13
    ['અન્ય વડીલો', -1],     // 14
    ['ચિરાગ', 14],          // 15
    ['જીજ્ઞેશ', 14]         // 16
  ];
  var people = rows.map(function (r, i) {
    return { id: 'p' + (i + 1), name: r[0], parent: r[1] < 0 ? null : 'p' + (r[1] + 1) };
  });
  root.FT = root.FT || {};
  root.FT.sample = { title: 'Vanshaa Vali', people: people };
})(typeof self !== 'undefined' ? self : globalThis);
