import React from 'react'

/**
 * Lets a descendant temporarily hide the docked native ASSIST pane while a
 * blocking HTML overlay (e.g. the GroupingsManager modal) is open. Native
 * webviews render above all HTML, so without this they'd cover the modal.
 *
 * The Shell provides a `setAssistSuppressed` setter; consumers call it with
 * `true` while their overlay is open and `false` when it closes. The Shell's
 * visibility effect ANDs this into `splitActive`, so closing restores the pane.
 */
export const AssistSuppressContext = React.createContext(null)
