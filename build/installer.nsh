; ==============================================================================
; PromptHound NSIS Custom Installer Theme & Script
; Dark Smoked Blue-Black Glass & Brand Orange Aesthetic
; ==============================================================================

!define MUI_BRANDINGTEXT "PromptHound · Extract · Organize · Create"
!define MUI_BGCOLOR "0B0E15"
!define MUI_TEXTCOLOR "F2F3F5"

; Custom Header Text & Styling
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_BITMAP "build\installerHeader.bmp"
!define MUI_HEADERIMAGE_RIGHT
!define MUI_WELCOMEFINISHPAGE_BITMAP "build\installerSidebar.bmp"
!define MUI_UNWELCOMEFINISHPAGE_BITMAP "build\installerSidebar.bmp"

; Progress Bar Color Message IDs
!define PBM_SETBARCOLOR 0x0409
!define PBM_SETBKCOLOR 0x2001

!macro customHeader
  ; Colors: Background #0B0E15 (RGB: 11, 14, 21 -> BGR: 0x150E0B)
  ; Orange Highlight: #F59A24 (RGB: 245, 154, 36 -> BGR: 0x249AF5)
  ; Text: #F2F3F5 (RGB: 242, 243, 245 -> BGR: 0xF5F3F2)
!macroend

!macro customInstall
  ; Executed after installation completes
!macroend

!macro customInit
  ; Initialize theme & colors
!macroend

!macro customPageAfterChange
  ; Style progress controls to PromptHound orange (#F59A24) and dark track (#141822)
  FindWindow $0 "#32770" "" $HWNDPARENT
  GetDlgItem $1 $0 1004 ; Progress bar ID
  ${If} $1 != 0
    SendMessage $1 ${PBM_SETBARCOLOR} 0 0x249AF5 ; Orange bar
    SendMessage $1 ${PBM_SETBKCOLOR} 0 0x221814  ; Dark blue-black track
  ${EndIf}
!macroend
