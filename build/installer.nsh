; ==============================================================================
; PromptHound installer: dark theme, welcome and finish pages.
; Included by electron-builder before its own script, so these defines apply to
; every Modern UI page. Artwork: build/installerSidebar.bmp and installerHeader.bmp
; (npm run build:installer-assets).
; ==============================================================================

; Header strip and welcome/finish pages share the app background and text colors
!define MUI_BGCOLOR "0B0E15"
!define MUI_TEXTCOLOR "F2F3F5"
!define MUI_BRANDINGTEXT "PromptHound ${VERSION}"
; Windows' themed checkbox ignores the text color and drew "Launch PromptHound" in
; black on the dark finish page; classic controls use MUI_TEXTCOLOR
!define MUI_FORCECLASSICCONTROLS

!macro customWelcomePage
  ; Updating over an existing install goes straight to installing
  !insertmacro skipPageIfUpdated
  !define MUI_WELCOMEPAGE_TITLE "Welcome to PromptHound ${VERSION}"
  !define MUI_WELCOMEPAGE_TITLE_3LINES
  !define MUI_WELCOMEPAGE_TEXT "PromptHound reads the prompt, settings, base model and LoRAs from AI-generated images (A1111 / Forge, ComfyUI, SwarmUI, Civitai and more) and keeps them in your own prompt library.$\r$\n$\r$\nIf an older version is installed, it is replaced; your library and settings are kept.$\r$\n$\r$\nClick Next to continue."
  !insertmacro MUI_PAGE_WELCOME
!macroend

!macro customFinishPage
  Function StartApp
    ${if} ${isUpdated}
      StrCpy $1 "--updated"
    ${else}
      StrCpy $1 ""
    ${endif}
    ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" "$1"
  FunctionEnd

  !define MUI_FINISHPAGE_TITLE "PromptHound is ready"
  !define MUI_FINISHPAGE_TITLE_3LINES
  !define MUI_FINISHPAGE_TEXT "PromptHound ${VERSION} has been installed.$\r$\n$\r$\nDrop an image on the window to see how it was made. New versions download in the background and install when you restart the app."
  !define MUI_FINISHPAGE_RUN
  !define MUI_FINISHPAGE_RUN_TEXT "Launch PromptHound"
  !define MUI_FINISHPAGE_RUN_FUNCTION "StartApp"
  !insertmacro MUI_PAGE_FINISH
!macroend
