Option Explicit
' Abre o MyLoot sem janela preta: o MyLoot.ps1 liga o servidor, abre a janela própria e põe o ícone na bandeja.
Dim sh, fso, dir, ps1
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
ps1 = dir & "\MyLoot.ps1"

If fso.FileExists(ps1) Then
  sh.CurrentDirectory = dir
  sh.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & ps1 & """", 0, False
Else
  MsgBox "Faltou o arquivo MyLoot.ps1 na pasta do MyLoot." & vbCrLf & "Baixe o MyLoot de novo ou use o ""Abrir MyLoot.bat"".", 48, "MyLoot"
End If