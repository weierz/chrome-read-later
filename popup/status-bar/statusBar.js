import * as action from '../action.js'
import * as filter from '../filter.js'

export function setup () {
    init()
    action.updateRowNumber()
    action.updateTotalNumber()
    $('#status-bar').on('click', event => {
        const clickType = event.target.closest('button')?.id
        const clickAction = filter.getClickAction(clickType)
        clickAction && clickAction()
    })
}

function init () {
    const archive = window.options?.archiveMode
        ? `<li><button type="button" id="archive" data-tooltip="Open reading list archive"
               aria-label="Open reading list archive">
              <img src="../../icons/archive.svg" alt="">
           </button>
           </li>`
        : ''

    $('#status-bar').append(`
     <li id="count" aria-label="Reading list count">
        <span id="row">0</span><span class="count-separator" aria-hidden="true">/</span><span id="total">0</span>
     </li>
     ${archive}
     <li><button type="button" id="options" data-tooltip="Options"
         aria-label="Options">
        <img src="../../icons/options.svg" alt="">
     </button>
     </li>
     <li><button type="button" id="question"
         data-tooltip="Help and feedback" aria-label="Help and feedback">
        <img src="../../icons/question.svg" alt="">
     </button>
     </li>
  `)
}
