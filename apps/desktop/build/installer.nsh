!macro customInstall
  CreateDirectory "$SMPROGRAMS\Localmod"
  CreateShortCut "$SMPROGRAMS\Localmod\Blackwhale.lnk" "$INSTDIR\Localmod.exe" "--app=blackwhale"
  CreateShortCut "$SMPROGRAMS\Localmod\Nightweaver.lnk" "$INSTDIR\Localmod.exe" "--app=nightweaver"
  CreateShortCut "$SMPROGRAMS\Localmod\Obsidian.lnk" "$INSTDIR\Localmod.exe" "--app=obsidian"
  CreateShortCut "$SMPROGRAMS\Localmod\Mako.lnk" "$INSTDIR\Localmod.exe" "--app=mako"
  CreateShortCut "$SMPROGRAMS\Localmod\The Trench.lnk" "$INSTDIR\Localmod.exe" "--app=trench"
  CreateShortCut "$SMPROGRAMS\Localmod\Ironmantis.lnk" "$INSTDIR\Localmod.exe" "--app=ironmantis"
!macroend
