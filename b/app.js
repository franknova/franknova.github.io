//model
var state = {
    bibleData: { NIV: NIV_DATA, NUVS: NUVS_DATA },
    currentVersion: 'NIV',
    currentBook: 1,
    currentChapter: 1,
    selectedVerse: 1,
    notes: {},
    isLoading: true,
    progress: 0,
    statusText: '准备中...',
    theme: localStorage.getItem('bible_theme') || 'light',
    searchQuery: '',
    searchResults: [],
    showBookList: localStorage.getItem('bible_show_booklist') !== 'false',
    showNotesPanel: localStorage.getItem('bible_show_notes') !== 'false',
    isNarrowScreen: window.innerWidth < 960,

    dispatch: function (action, args) {
        state[action].apply(state, args || [])
        requestAnimationFrame(function () {
            localStorage["bible_state"] = JSON.stringify({
                version: state.currentVersion,
                book: state.currentBook,
                chapter: state.currentChapter
            })
            localStorage["bible_notes"] = JSON.stringify(state.notes)
            localStorage["bible_theme"] = state.theme
            localStorage["bible_show_booklist"] = state.showBookList
            localStorage["bible_show_notes"] = state.showNotesPanel
        })
    },

    init: function () {
        state.loadNotes()
        state.restoreState()
        state.handleResize()
        window.addEventListener('resize', state.handleResize)
        
        // 窄屏模式下，首次加载时默认隐藏所有侧边栏
        if (state.isNarrowScreen) {
            state.showBookList = false
            state.showNotesPanel = false
        }
        
        m.redraw()
    },

    handleResize: function () {
        const wasNarrow = state.isNarrowScreen
        state.isNarrowScreen = window.innerWidth < 960
        
        // 切换到窄屏时，如果两个侧边栏都打开，关闭笔记面板
        if (!wasNarrow && state.isNarrowScreen) {
            if (state.showBookList && state.showNotesPanel) {
                state.showNotesPanel = false
            }
        }
        m.redraw()
    },


    loadNotes: function () {
        const saved = localStorage.getItem('bible_notes')
        if (saved) {
            try {
                state.notes = JSON.parse(saved)
            } catch (e) {
                state.notes = {}
            }
        }
    },

    restoreState: function () {
        const saved = localStorage.getItem('bible_state')
        if (saved) {
            try {
                const s = JSON.parse(saved)
                state.currentVersion = s.version || 'NIV'
                state.currentBook = s.book || 1
                state.currentChapter = s.chapter || 1
            } catch (e) { }
        }
    },

    saveNotes: function () {
        localStorage.setItem('bible_notes', JSON.stringify(state.notes))
    },

    exportNotes: function () {
        const data = JSON.stringify(state.notes, null, 2)
        const blob = new Blob([data], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'bible-notes-' + new Date().toISOString().slice(0, 10) + '.json'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    },

    importNotes: function (file) {
        if (!file) return
        const reader = new FileReader()
        reader.onload = function (e) {
            try {
                const imported = JSON.parse(e.target.result)
                if (typeof imported === 'object' && imported !== null) {
                    state.notes = imported
                    state.saveNotes()
                    m.redraw()
                } else {
                    throw new Error('Invalid format')
                }
            } catch (err) {
                alert('导入失败：文件格式错误')
            }
        }
        reader.readAsText(file)
    },

    selectVersion: function (version) {
        state.currentVersion = version
        state.saveState()
        m.redraw()
    },

    selectBook: function (book) {
        state.currentBook = book
        state.currentChapter = 1
        state.selectedVerse = 1
        state.saveState()
        m.redraw()
    },

    prevChapter: function () {
        if (state.currentChapter > 1) {
            state.currentChapter--
        } else if (state.currentBook > 1) {
            state.currentBook--
            state.currentChapter = state.getMaxChapter(state.currentBook)
        }
        state.selectedVerse = 1
        state.saveState()
    },

    nextChapter: function () {
        const maxChapter = state.getMaxChapter(state.currentBook)
        if (state.currentChapter < maxChapter) {
            state.currentChapter++
        } else if (state.currentBook < 66) {
            state.currentBook++
            state.currentChapter = 1
        }
        state.selectedVerse = 1
        state.saveState()
    },

    jumpToChapter: function (chapter) {
        const maxChapter = state.getMaxChapter(state.currentBook)
        if (chapter >= 1 && chapter <= maxChapter) {
            state.currentChapter = chapter
            state.selectedVerse = 1
            state.saveState()
        }
    },

    selectVerse: function (verse) {
        state.selectedVerse = verse
    },

    saveCurrentNote: function (text) {
        if (!state.selectedVerse) return
        const key = `${state.currentBook}_${state.currentChapter}_${state.selectedVerse}`
        if (text) {
            state.notes[key] = text
        } else {
            delete state.notes[key]
        }
        state.saveNotes()
    },

    deleteNote: function (key) {
        if (confirm('确定删除这条笔记？')) {
            delete state.notes[key]
            state.saveNotes()
        }
    },

    getMaxChapter: function (book) {
        const data = state.bibleData[state.currentVersion]
        const chapters = data.books[book]
        return chapters ? Math.max(...Object.keys(chapters).map(Number)) : 1
    },

    getCurrentBookName: function () {
        const bookNum = state.currentBook
        return BOOK_NAMES[bookNum]
    },

    getChapters: function () {
        const data = state.bibleData[state.currentVersion]
        return data.books[state.currentBook] || {}
    },

    getVerses: function () {
        const chapters = state.getChapters()
        return chapters[state.currentChapter] || []
    },

    getCurrentRef: function () {
        const bookName = state.getCurrentBookName()
        if (state.selectedVerse) {
            return `${bookName} ${state.currentChapter}:${state.selectedVerse}`
        } else {
            return `${bookName} ${state.currentChapter}:点击经文添加笔记`
        }
    },

    getNotesForCurrentVerse: function () {
        if (!state.selectedVerse) return []
        const key = `${state.currentBook}_${state.currentChapter}_${state.selectedVerse}`
        return state.notes[key] || ''
    },

    getNotesForCurrentChapter: function () {
        return Object.entries(state.notes)
            .filter(([key]) => key.startsWith(`${state.currentBook}_${state.currentChapter}_`))
            .sort((a, b) => {
                const aVerse = parseInt(a[0].split('_')[2])
                const bVerse = parseInt(b[0].split('_')[2])
                return aVerse - bVerse
            })
    },

    isVerseWithNote: function (verse) {
        const key = `${state.currentBook}_${state.currentChapter}_${verse}`
        return state.notes.hasOwnProperty(key)
    },

    saveState: function () {
        localStorage.setItem('bible_state', JSON.stringify({
            version: state.currentVersion,
            book: state.currentBook,
            chapter: state.currentChapter
        }))
    },

    toggleTheme: function () {
        state.theme = state.theme === 'light' ? 'dark' : 'light'
        document.documentElement.setAttribute('data-theme', state.theme)
    },

    toggleBookList: function () {
        state.showBookList = !state.showBookList
        // 窄屏模式下，打开书卷列表时关闭笔记面板
        if (state.isNarrowScreen && state.showBookList && state.showNotesPanel) {
            state.showNotesPanel = false
        }
    },

    toggleNotesPanel: function () {
        state.showNotesPanel = !state.showNotesPanel
        // 窄屏模式下，打开笔记面板时关闭书卷列表
        if (state.isNarrowScreen && state.showNotesPanel && state.showBookList) {
            state.showBookList = false
        }
    },

    search: function (query) {
        state.searchQuery = query
        if (!query) {
            state.searchResults = []
            return
        }
        const results = []
        const data = state.bibleData[state.currentVersion]
        const queryLower = query.toLowerCase()
        Object.keys(data.books).forEach(bookNum => {
            const bookName = BOOK_NAMES[bookNum]
            Object.keys(data.books[bookNum]).forEach(chapter => {
                const verses = data.books[bookNum][chapter]
                verses.forEach(v => {
                    if (v.t.toLowerCase().includes(queryLower)) {
                        results.push({
                            book: bookNum,
                            chapter: parseInt(chapter),
                            verse: v.v,
                            text: v.t.replace(new RegExp(queryLower, 'g'), (match) => {
                                return `<strong>${match}</strong>`
                            }),
                            ref: `${bookName} ${chapter}:${v.v}`
                        })
                    }
                })
            })
        })
        state.searchResults = results.slice(0, 50)
    },

    jumpToSearchResult: function (result) {
        state.currentBook = result.book
        state.currentChapter = result.chapter
        state.selectedVerse = result.verse
        state.searchQuery = ''
        state.searchResults = []
        state.saveState()
    },

    renderSimpleMarkdown: function (text) {
        if (!text) return ''
        
        // 使用 marked.parse 新 API
        return marked.parse(text, {
            breaks: true,  // 支持换行
            gfm: true      // 启用 GitHub Flavored Markdown
        })
    }
}

var BOOK_NAMES = [
    "", "创世记", "出埃及记", "利未记", "民数记", "申命记", "约书亚记", "士师记", "路得记",
    "撒母耳记上", "撒母耳记下", "列王纪上", "列王纪下", "历代志上", "历代志下", "以斯拉记",
    "尼希米记", "以斯帖记", "约伯记", "诗篇", "箴言", "传道书", "雅歌", "以赛亚书", "耶利米书",
    "耶利米哀歌", "以西结书", "但以理书", "何西阿书", "约珥书", "阿摩司书", "俄巴底亚书",
    "约拿书", "弥迦书", "那鸿书", "哈巴谷书", "西番雅书", "哈该书", "撒迦利亚书", "玛拉基书",
    "马太福音", "马可福音", "路加福音", "约翰福音", "使徒行传", "罗马书", "哥林多前书",
    "哥林多后书", "加拉太书", "以弗所书", "腓立比书", "歌罗西书", "帖撒罗尼迦前书",
    "帖撒罗尼迦后书", "提摩太前书", "提摩太后书", "提多书", "腓利门书", "希伯来书", "雅各书",
    "彼得前书", "彼得后书", "约翰一书", "约翰二书", "约翰三书", "犹大书", "启示录"
]

var BOOK_SIGN = [
    "", "创", "出", "利", "民", "申", "书", "士", "得",
    "撒上", "撒下", "王上", "王下", "代上", "代下", "拉",
    "尼", "斯", "伯", "诗", "箴", "传", "歌", "赛", "耶",
    "哀", "结", "但", "何", "珥", "摩", "俄",
    "拿", "弥", "鸿", "哈", "番", "该", "亚", "玛",
    "太", "可", "路", "约", "徒", "罗", "林前",
    "林后", "加", "弗", "腓", "西", "帖前",
    "帖后", "提前", "提后", "多", "门", "来", "雅",
    "彼前", "彼后", "约一", "约二", "约三", "犹", "启"
]

//view
var SearchBar = {
    view: function () {
        return m('div.search-container', [
            m('input.search-input', {
                type: 'text',
                placeholder: '搜索经文...',
                value: state.searchQuery,
                oninput: function (e) { state.dispatch('search', [e.target.value]) }
            }),
            state.searchQuery && m('button.search-clear', {
                onclick: function () { state.dispatch('search', ['']) }
            }, '×'),
            state.searchResults.length > 0 ? m('div.search-results', [
                state.searchResults.map(r => m('div.search-result-item', {
                    onclick: function () { state.dispatch('jumpToSearchResult', [r]) }
                }, [
                    m('span.search-result-ref', r.ref),
                    m('span.search-result-text', m.trust(r.text))
                ]))
            ]) : null
        ])
    }
}

var BookList = {
    view: function () {
        const data = state.bibleData[state.currentVersion]
        const books = Object.keys(data.books).map(Number).sort((a, b) => a - b)

        return m('div.book-list', [
            m('div.version-buttons', [
                m('button.version-btn', {
                    class: state.currentVersion === 'NUVS' ? 'active' : '',
                    onclick: function () { state.dispatch('selectVersion', ['NUVS']) }
                }, '和合本'),
                m('button.version-btn', {
                    class: state.currentVersion === 'NIV' ? 'active' : '',
                    onclick: function () { state.dispatch('selectVersion', ['NIV']) }
                }, 'NIV'),
                m('button.theme-btn', {
                    onclick: function () { state.dispatch('toggleTheme') }
                }, state.theme === 'light' ? '🌙' : '☀️')
            ]),
            m(SearchBar),
            books.map(bookNum => {
                const name = BOOK_SIGN[bookNum]
                return m('div.book-list-item', {
                    class: bookNum === state.currentBook ? 'active' : '',
                    onclick: function () { state.dispatch('selectBook', [bookNum]) }
                }, [
                    m('span', name),
                ])
            })
        ])
    }
}

var ChapterNav = {
    view: function () {
        const maxChapter = state.getMaxChapter(state.currentBook)
        const bookName = state.getCurrentBookName()

        return m('div.chapter-nav', [
            m('button.toggle-btn', {
                onclick: function () { state.dispatch('toggleBookList') },
                title: state.showBookList ? '隐藏书卷列表' : '显示书卷列表'
            }, '📖'),
            m('button', { onclick: function () { state.dispatch('prevChapter') } }, '◀'),
            m('button', { onclick: function () { state.dispatch('nextChapter') } }, '▶'),
            m('span.chapter-info', `${bookName} ${state.currentChapter}/${maxChapter}`),
            m('div.chapter-input-group', [
                m('input[type=number][min=1]', {
                    id: 'chapterInput',
                    max: maxChapter,
                    onkeypress: function (e) {
                        if (e.key === 'Enter') {
                            const val = parseInt(e.target.value)
                            if (val >= 1 && val <= maxChapter) {
                                state.dispatch('jumpToChapter', [val])
                                e.target.value = ''
                            }
                        }
                    }
                }),
                m('span', '章 ')
            ]),
            m('button.toggle-btn', {
                onclick: function () { state.dispatch('toggleNotesPanel') },
                title: state.showNotesPanel ? '隐藏笔记栏' : '显示笔记栏'
            }, '📝')
        ])
    }
}

var VersesContainer = {
    view: function () {
        const verses = state.getVerses()

        return m('div.verses-container', [
            verses.map(v => {
                return m('div.verse-row', {
                    class: (state.selectedVerse === v.v ? 'selected' : '') +
                        (state.isVerseWithNote(v.v) ? ' active-note' : ''),
                    onclick: function () { state.dispatch('selectVerse', [v.v]) }
                }, [
                    m('span.verse-num', v.v),
                    m('span.verse-text.' + state.currentVersion.toLowerCase(), v.t)
                ])
            })
        ])
    }
}

var NotesPanel = {
    view: function () {
        const currentRef = state.getCurrentRef()
        const currentNote = state.getNotesForCurrentVerse()
        const chapterNotes = state.getNotesForCurrentChapter()

        return m('div.notes-panel', [
            m('div.notes-header', [
                m('span.notes-title', '笔记记录'),
                m('div.notes-actions', [
                    m('button.export-btn', {
                        style: 'float:right;padding:3px 10px;font-size:0.75rem;background:#5cb85c;color:white;border:none;border-radius:3px;cursor:pointer;',
                        onclick: function () { state.dispatch('exportNotes') }
                    }, '导出'),
                    m('button.import-btn', {
                        style: 'float:right;padding:3px 10px;font-size:0.75rem;background:#f0ad4e;color:white;border:none;border-radius:3px;cursor:pointer;margin-right:8px;',
                        onclick: function () { document.getElementById('importFile').click() }
                    }, '导入'),
                    m('input#importFile.import-file', {
                        type: 'file',
                        accept: '.json',
                        onchange: function (e) { state.dispatch('importNotes', [e.target.files[0]]) }
                    })
                ])
            ]),
            m('div.current-ref', currentRef),
            m('div.notes-list', [
                state.selectedVerse ? m('div.note-item', [
                    m('div.note-ref', [
                        m('span', currentRef),
                        m('span.delete-note', {
                            onclick: function (e) {
                                e.stopPropagation()
                                const key = `${state.currentBook}_${state.currentChapter}_${state.selectedVerse}`
                                state.dispatch('deleteNote', [key])
                            }
                        }, '删除')
                    ]),
                    m('textarea.note-edit', {
                        placeholder: '在此输入笔记... (支持 Markdown)',
                        value: currentNote,
                        oninput: function (e) { state.dispatch('saveCurrentNote', [e.target.value]) }
                    })
                ]) : null,

                chapterNotes.length > 0 ? [
                    state.selectedVerse ? m('div', {
                        style: 'margin:15px 0;border-top:1px solid #ddd;padding-top:15px;font-size:0.85rem;color:#666;'
                    }, '本章笔记') : null,

                    chapterNotes.map(([key, text]) => {
                        const parts = key.split('_')
                        const verse = parseInt(parts[2])
                        const bookName = state.getCurrentBookName()

                        return m('div.note-item', {
                            class: state.selectedVerse === verse ? 'active-note' : '',
                            onclick: function () { state.dispatch('selectVerse', [verse]) }
                        }, [
                            m('div.note-ref', [
                                m('span', `${bookName} ${state.currentChapter}:${verse}`),
                                m('span.delete-note', {
                                    onclick: function (e) {
                                        e.stopPropagation()
                                        state.dispatch('deleteNote', [key])
                                    }
                                }, '删除')
                            ]),
                            m('div.note-content', m.trust(state.renderSimpleMarkdown(text)))
                        ])
                    })
                ] : null,

                !state.selectedVerse && chapterNotes.length === 0 ?
                    m('p', { style: 'color:#999;text-align:center;padding:20px;' }, '点击经文添加/编辑笔记') : null
            ])
        ])
    }
}

var BibleApp = {
    oninit: function () {
        state.init()
        document.documentElement.setAttribute('data-theme', state.theme)
    },
    view: function () {
        return m('div.main-container', [
            state.showBookList ? m(BookList) : null,
            m('div.bible-panel', [
                m('div.content-area', [
                    m(ChapterNav),
                    m(VersesContainer)
                ])
            ]),
            state.showNotesPanel ? m(NotesPanel) : null
        ])
    }
}

m.mount(document.getElementById('app'), BibleApp)