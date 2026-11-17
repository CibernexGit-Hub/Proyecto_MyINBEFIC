$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

function Escape-XmlText([string]$Text) {
    [System.Security.SecurityElement]::Escape($Text)
}

function Convert-InlineTextToWordRuns([string]$Text) {
    $pattern = '\*\*(.+?)\*\*|`([^`]+)`'
    $builder = New-Object System.Text.StringBuilder
    $lastIndex = 0

    foreach ($match in [regex]::Matches($Text, $pattern)) {
        $plainText = $Text.Substring($lastIndex, $match.Index - $lastIndex)
        if ($plainText) {
            [void]$builder.Append('<w:r><w:t xml:space="preserve">' + (Escape-XmlText $plainText) + '</w:t></w:r>')
        }

        $content = if ($match.Groups[1].Success) { $match.Groups[1].Value } else { $match.Groups[2].Value }
        $properties = if ($match.Groups[1].Success) {
            '<w:b/>'
        } else {
            '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:color w:val="365F91"/>'
        }
        [void]$builder.Append(
            '<w:r><w:rPr>' + $properties + '</w:rPr><w:t xml:space="preserve">' +
            (Escape-XmlText $content) + '</w:t></w:r>'
        )
        $lastIndex = $match.Index + $match.Length
    }

    $tail = $Text.Substring($lastIndex)
    if ($tail) {
        [void]$builder.Append('<w:r><w:t xml:space="preserve">' + (Escape-XmlText $tail) + '</w:t></w:r>')
    }
    $builder.ToString()
}

function New-WordParagraph([string]$Text, [string]$Style = 'Normal', [string]$ParagraphProperties = '') {
    '<w:p><w:pPr><w:pStyle w:val="' + $Style + '"/>' + $ParagraphProperties + '</w:pPr>' +
    (Convert-InlineTextToWordRuns $Text) + '</w:p>'
}

function New-WordTable($Rows) {
    if ($Rows.Count -eq 0) {
        return ''
    }

    $columnCount = $Rows[0].Count
    $columnWidth = [Math]::Floor(9000 / $columnCount)
    $builder = New-Object System.Text.StringBuilder
    [void]$builder.Append(
        '<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="5000" w:type="pct"/>' +
        '<w:tblBorders><w:top w:val="single" w:sz="4" w:color="A6B6C7"/>' +
        '<w:left w:val="single" w:sz="4" w:color="A6B6C7"/><w:bottom w:val="single" w:sz="4" w:color="A6B6C7"/>' +
        '<w:right w:val="single" w:sz="4" w:color="A6B6C7"/><w:insideH w:val="single" w:sz="4" w:color="A6B6C7"/>' +
        '<w:insideV w:val="single" w:sz="4" w:color="A6B6C7"/></w:tblBorders></w:tblPr><w:tblGrid>'
    )
    for ($column = 0; $column -lt $columnCount; $column++) {
        [void]$builder.Append('<w:gridCol w:w="' + $columnWidth + '"/>')
    }
    [void]$builder.Append('</w:tblGrid>')

    for ($rowIndex = 0; $rowIndex -lt $Rows.Count; $rowIndex++) {
        [void]$builder.Append('<w:tr>')
        for ($column = 0; $column -lt $columnCount; $column++) {
            $cellText = if ($column -lt $Rows[$rowIndex].Count) { [string]$Rows[$rowIndex][$column] } else { '' }
            $cellProperties = '<w:tcW w:w="' + $columnWidth + '" w:type="dxa"/>'
            $runs = Convert-InlineTextToWordRuns $cellText
            if ($rowIndex -eq 0) {
                $cellProperties += '<w:shd w:fill="1F4E79"/><w:tcMar><w:top w:w="80" w:type="dxa"/>' +
                    '<w:start w:w="90" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/>' +
                    '<w:end w:w="90" w:type="dxa"/></w:tcMar>'
                $runs = '<w:r><w:rPr><w:color w:val="FFFFFF"/><w:b/></w:rPr><w:t xml:space="preserve">' +
                    (Escape-XmlText $cellText) + '</w:t></w:r>'
            }
            [void]$builder.Append(
                '<w:tc><w:tcPr>' + $cellProperties + '</w:tcPr><w:p><w:pPr><w:spacing w:after="40"/>' +
                '</w:pPr>' + $runs + '</w:p></w:tc>'
            )
        }
        [void]$builder.Append('</w:tr>')
    }
    [void]$builder.Append('</w:tbl><w:p/>')
    $builder.ToString()
}

$styles = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
 <w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="21"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="280" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
 <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
 <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="260"/></w:pPr><w:rPr><w:b/><w:color w:val="14395B"/><w:sz w:val="36"/></w:rPr></w:style>
 <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="300" w:after="160"/></w:pPr><w:rPr><w:b/><w:color w:val="1F4E79"/><w:sz w:val="30"/></w:rPr></w:style>
 <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="220" w:after="100"/></w:pPr><w:rPr><w:b/><w:color w:val="365F91"/><w:sz w:val="24"/></w:rPr></w:style>
 <w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/></w:style>
</w:styles>
'@
$contentTypes = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
 <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
 <Default Extension="xml" ContentType="application/xml"/>
 <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
 <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>
'@
$packageRelationships = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
 <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>
'@
$documentRelationships = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
 <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>
'@
$documents = @(
    @{ Markdown = 'docs\manual-programador.md'; Output = 'docs\Manual_del_Programador_INBEFIC.docx' },
    @{ Markdown = 'docs\plan-operativo-contingencial.md'; Output = 'docs\Plan_Operativo_Contingencial_INBEFIC.docx' }
)

foreach ($item in $documents) {
    $lines = Get-Content -LiteralPath $item.Markdown -Encoding UTF8
    $body = New-Object System.Text.StringBuilder
    $insideCodeBlock = $false
    for ($index = 0; $index -lt $lines.Count;) {
        $line = $lines[$index].TrimEnd()
        if (!$line) {
            $index++
            continue
        }
        if ($line.StartsWith('```')) {
            $insideCodeBlock = !$insideCodeBlock
            $index++
            continue
        }
        if ($insideCodeBlock) {
            $paragraphProperties = '<w:shd w:fill="F3F4F6"/><w:spacing w:before="60" w:after="60"/>'
            [void]$body.Append((New-WordParagraph $line 'Normal' $paragraphProperties))
            $index++
            continue
        }
        if ($line.StartsWith('|')) {
            $rows = New-Object System.Collections.Generic.List[object]
            while ($index -lt $lines.Count -and $lines[$index].TrimStart().StartsWith('|')) {
                $cells = @($lines[$index].Trim().Trim('|').Split('|') | ForEach-Object { $_.Trim() })
                if (($cells -join '') -notmatch '^:?-{3,}:?$') {
                    $rows.Add($cells)
                }
                $index++
            }
            [void]$body.Append((New-WordTable $rows))
            continue
        }
        if ($line.StartsWith('# ')) {
            [void]$body.Append((New-WordParagraph $line.Substring(2) 'Title'))
        } elseif ($line.StartsWith('## ')) {
            [void]$body.Append((New-WordParagraph $line.Substring(3) 'Heading1'))
        } elseif ($line.StartsWith('### ')) {
            [void]$body.Append((New-WordParagraph $line.Substring(4) 'Heading2'))
        } elseif ($line.StartsWith('- ')) {
            [void]$body.Append((New-WordParagraph ('•  ' + $line.Substring(2)) 'Normal' '<w:ind w:left="360"/>'))
        } else {
            [void]$body.Append((New-WordParagraph $line))
        }
        $index++
    }

    $documentXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
        $body.ToString() +
        '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>' +
        '</w:body></w:document>'

    if (Test-Path -LiteralPath $item.Output) {
        Remove-Item -LiteralPath $item.Output
    }
    $archive = [System.IO.Compression.ZipFile]::Open(
        (Join-Path (Get-Location) $item.Output),
        [System.IO.Compression.ZipArchiveMode]::Create
    )
    try {
        $entries = @(
            @{ Name = '[Content_Types].xml'; Text = $contentTypes },
            @{ Name = '_rels/.rels'; Text = $packageRelationships },
            @{ Name = 'word/document.xml'; Text = $documentXml },
            @{ Name = 'word/styles.xml'; Text = $styles },
            @{ Name = 'word/_rels/document.xml.rels'; Text = $documentRelationships }
        )
        foreach ($entry in $entries) {
            $zipEntry = $archive.CreateEntry($entry.Name, [System.IO.Compression.CompressionLevel]::Optimal)
            $stream = $zipEntry.Open()
            $writer = [System.IO.StreamWriter]::new($stream, (New-Object System.Text.UTF8Encoding($false)))
            try {
                $writer.Write($entry.Text)
            } finally {
                $writer.Dispose()
            }
        }
    } finally {
        $archive.Dispose()
    }

    $check = [System.IO.Compression.ZipFile]::OpenRead((Join-Path (Get-Location) $item.Output))
    try {
        $documentEntry = $check.GetEntry('word/document.xml')
        $reader = [System.IO.StreamReader]::new($documentEntry.Open())
        try {
            [xml]$validatedDocument = $reader.ReadToEnd()
        } finally {
            $reader.Dispose()
        }
        $namespace = [System.Xml.XmlNamespaceManager]::new($validatedDocument.NameTable)
        $namespace.AddNamespace('w', 'http://schemas.openxmlformats.org/wordprocessingml/2006/main')
        $paragraphCount = $validatedDocument.SelectNodes('//w:p', $namespace).Count
        $tableCount = $validatedDocument.SelectNodes('//w:tbl', $namespace).Count
        '{0}: {1} bytes, {2} paragraphs, {3} tables' -f $item.Output, (Get-Item $item.Output).Length, $paragraphCount, $tableCount
    } finally {
        $check.Dispose()
    }
}
