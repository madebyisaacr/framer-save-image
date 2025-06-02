import { framer, isFrameNode, isComponentInstanceNode, isImageAsset } from "framer-plugin"
import { useState, useEffect, useMemo, useRef } from "react"
import "./App.css"
import { copyToClipboard, downloadFile } from "./utils"
import classNames from "classnames"

export function App() {
    const selection = useSelection()
    const image = useImage()
    const [collection, setCollection] = useState(null)
    const [collectionItems, setCollectionItems] = useState([])
    const [collectionFields, setCollectionFields] = useState([])

    const [rows, columns, titleColumnName] = useMemo(() => {
        const rows = []
        const columns = []
        let titleColumnName = ""

        if (framer.mode === "collection") {
            if (collection && collectionFields.length > 0) {
                let titleField = null
                if (collection.slugFieldBasedOn) {
                    titleField = collectionFields.find(field => field.id === collection.slugFieldBasedOn)
                } else {
                    titleField = collectionFields.find(field => field.name === "Title")
                }

                if (titleField) {
                    titleColumnName = titleField.name
                }

                for (const field of collectionFields) {
                    if (field.type === "image") {
                        columns.push(field.name)
                    }
                }

                for (const item of collectionItems) {
                    const columnValues = {}

                    for (const field of collectionFields) {
                        if (columns.indexOf(field.name) !== -1) {
                            columnValues[field.name] = [item.fieldData[field.id]?.value]
                        }
                    }

                    rows.push({
                        id: item.id,
                        title: item.fieldData[titleField.id]?.value,
                        columns: columnValues,
                    })
                }
            }
        } else {
            titleColumnName = "Name"
            columns.push("Images")

            for (const node of selection) {
                let nodeImages = []
                let type = "frame"

                if (isFrameNode(node)) {
                    if (isImageAsset(node.backgroundImage)) {
                        nodeImages.push(node.backgroundImage)
                    }
                } else if (isComponentInstanceNode(node)) {
                    type = "component"
                    if (node.controls) {
                        for (const value of Object.values(node.controls)) {
                            if (isImageAsset(value)) {
                                nodeImages.push(value)
                            }
                        }
                    }
                }

                if (nodeImages.length > 0) {
                    rows.push({
                        id: node.id,
                        title: node.name,
                        columns: { Images: nodeImages },
                        type,
                    })
                }
            }
        }

        return [rows, columns, titleColumnName]
    }, [selection, collection])

    useEffect(() => {
        if (framer.mode === "collection") {
            const updateCollection = async () => {
                const collection = await framer.getActiveCollection()
                const [items, fields] = await Promise.all([collection.getItems(), collection.getFields()])

                setCollection(collection)
                setCollectionItems(items)
                setCollectionFields(fields)
            }

            updateCollection()
        }
    }, [])

    return framer.mode === "collection" ? (
        <Table rows={rows} columns={columns} titleColumnName={titleColumnName} isCollectionMode />
    ) : image ? (
        <SingleImageView image={image} />
    ) : rows.length > 0 ? (
        <Table rows={rows} columns={columns} titleColumnName={titleColumnName} />
    ) : (
        <SingleImageView />
    )
}

function SingleImageView({ image }) {
    useEffect(() => {
        framer.showUI({
            position: "top right",
            width: 260,
            height: 300,
        })
    }, [])

    return (
        <main className="flex-col px-3 pb-3 gap-2 size-full overflow-hidden select-none">
            <div className="w-full flex-1 overflow-hidden bg-secondary rounded flex center">
                {image ? (
                    <img src={image.url} alt={image.altText} className="size-full object-contain" draggable={false} />
                ) : (
                    <span className="text-tertiary">Select an image</span>
                )}
            </div>
            <ImageButtons image={image} />
        </main>
    )
}

function Table({ rows, columns, titleColumnName, isCollectionMode = false }) {
    const tableRef = useRef(null)

    const [activeImage, setActiveImage] = useState(null)
    const [activeImageElement, setActiveImageElement] = useState(null)

    const flattenedRowImages = useMemo(() => {
        return Array.isArray(rows)
            ? rows.map(row => {
                  const images = []

                  for (const columnName of Object.keys(row.columns)) {
                      if (Array.isArray(row.columns[columnName])) {
                          images.push(...row.columns[columnName])
                      }
                  }

                  return images
              })
            : []
    }, [rows])

    function changeActiveImage(image, element) {
        if (!image) return

        const isSelecting = image !== activeImage
        if (isSelecting) {
            setActiveImage(image)
            setActiveImageElement(element)
        } else {
            setActiveImage(null)
            setActiveImageElement(null)
        }
    }

    useEffect(() => {
        if (!tableRef.current) return

        const updateSize = () => {
            if (!tableRef.current) return

            framer.showUI({
                position: "top right",
                width: Math.max(Math.min(tableRef.current.offsetWidth, 600), 260),
                height: Math.max(Math.min(tableRef.current.offsetHeight, 500), 158),
            })
        }

        // Initial size update
        updateSize()

        // Set up resize observer
        const resizeObserver = new ResizeObserver(updateSize)
        resizeObserver.observe(tableRef.current)

        return () => {
            resizeObserver.disconnect()
        }
    }, [activeImage, activeImageElement])

    // Add keyboard event listener for Escape key
    useEffect(() => {
        const handleKeyDown = event => {
            if (event.key === "Escape" && activeImage) {
                setActiveImage(null)
                setActiveImageElement(null)
            }
        }

        window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
    }, [activeImage])

    return (
        <div className="overflow-auto h-full flex-col select-none relative">
            <div ref={tableRef} className="flex-col pb-3 min-w-max">
                <table>
                    <thead className="h-10 text-left">
                        <tr className="relative">
                            <TableHeading className="min-w-[100px] pl-3">{titleColumnName}</TableHeading>
                            {columns.map(column => (
                                <TableHeading key={column} className="pr-3">
                                    {column}
                                </TableHeading>
                            ))}
                            <div className="absolute inset-x-3 top-0 h-px bg-divider" />
                            <div className="absolute inset-x-3 bottom-0 h-px bg-divider" />
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, index) => (
                            <TableRow
                                key={row.id}
                                row={row}
                                columns={columns}
                                isLastRow={index === rows.length - 1}
                                isCollectionMode={isCollectionMode}
                                activeImage={activeImage}
                                changeActiveImage={changeActiveImage}
                            />
                        ))}
                    </tbody>
                </table>
                <div className="flex-col gap-3 px-3">
                    <div className="w-full h-px bg-divider shrink-0" />
                    <ImageButtons image={activeImage} />
                </div>
            </div>
        </div>
    )
}

function TableHeading({ children, className }) {
    return <th className={classNames("text-tertiary hover:text-primary font-medium", className)}>{children}</th>
}

function TableRow({ row, columns, isLastRow = false, isCollectionMode = false, activeImage, changeActiveImage }) {
    const imageElements = useRef([])

    const includesActiveImage = useMemo(() => {
        return columns.some(columnName => {
            return Array.isArray(row.columns?.[columnName]) && row.columns[columnName].includes(activeImage)
        })
    }, [row, columns, activeImage])

    return (
        <tr
            className={classNames(
                "h-10 text-secondary hover:text-primary font-medium px-3 relative",
                includesActiveImage && "text-primary bg-[#FCFCFC]"
            )}
        >
            <td
                className={classNames(
                    "text-nowrap px-3 truncate",
                    isCollectionMode ? "min-w-[200px] max-w-[300px]" : "max-w-[200px]"
                )}
            >
                {row.title}
                {!isLastRow && <div className="absolute inset-x-3 bottom-0 h-px bg-divider" />}
            </td>
            {columns.map((columnName, columnIndex) => (
                <td>
                    <div className="flex-row gap-2 h-10">
                        {Array.isArray(row.columns?.[columnName])
                            ? row.columns[columnName].map((image, index) => (
                                  <div
                                      className={classNames("flex-col center h-full shrink-0 cursor-pointer", "w-10")}
                                      ref={el => (imageElements.current[index] = el)}
                                      onClick={() => changeActiveImage(image, imageElements.current[index])}
                                  >
                                      <div
                                          className={classNames(
                                              "w-full h-[22px] relative rounded-[4px] bg-secondary transition-transform"
                                          )}
                                      >
                                          {image && (
                                              <>
                                                  {activeImage === image && (
                                                      <div className="absolute -inset-[3px] border border-tint rounded-[7px]">
                                                          <div className="bg-tint rounded-[inherit] absolute inset-0 opacity-15" />
                                                      </div>
                                                  )}
                                                  <img
                                                      src={`${image.url}?scale-down-to=512`}
                                                      alt={image.altText}
                                                      className="size-full object-cover rounded-[inherit] relative"
                                                      draggable={false}
                                                  />
                                                  <div className="absolute inset-0 border border-image-border rounded-[inherit]" />
                                              </>
                                          )}
                                      </div>
                                  </div>
                              ))
                            : null}
                    </div>
                </td>
            ))}
        </tr>
    )
}

function ImageButtons({ image, row = false, onButtonClick = null }) {
    const hasImage = image ? true : false

    async function onCopyImageClick() {
        if (!image) return

        // Fetch the image as a blob
        const response = await fetch(image.url)
        const blob = await response.blob()

        // Create a ClipboardItem
        const clipboardItem = new ClipboardItem({ [blob.type]: blob })

        // Write to clipboard
        try {
            await navigator.clipboard.write([clipboardItem])
            framer.notify("Image copied to clipboard!", { variant: "success" })
        } catch (err) {
            console.error(err)
            framer.notify("Failed to copy image", { variant: "error" })
        }

        if (onButtonClick) onButtonClick()
    }

    function onCopyImageUrlClick() {
        if (!image) return

        const success = copyToClipboard(image.url)
        if (success) {
            framer.notify("Image URL copied to clipboard!", { variant: "success" })
        } else {
            framer.notify("Failed to copy image URL", { variant: "error" })
        }

        if (onButtonClick) onButtonClick()
    }

    function onDownloadImageClick() {
        if (!image) return

        const success = downloadFile(image.url, image.id)
        if (success) {
            framer.notify("Image downloaded!", { variant: "success" })
        } else {
            framer.notify("Failed to download image", { variant: "error" })
        }

        if (onButtonClick) onButtonClick()
    }

    return row ? (
        <div className="flex-row gap-2 w-full">
            <button disabled={!hasImage} onClick={onCopyImageClick} className="w-fit px-2.5">
                Copy Image
            </button>
            <button disabled={!hasImage} onClick={onCopyImageUrlClick} className="w-fit px-2.5">
                Copy URL
            </button>
            <button disabled={!hasImage} onClick={onDownloadImageClick} className="framer-button-primary w-fit px-2.5">
                Download
            </button>
        </div>
    ) : (
        <div className="flex-col gap-2 w-full">
            <div className="flex-row gap-2 flex-1">
                <button disabled={!hasImage} onClick={onCopyImageClick} className="flex-1">
                    Copy Image
                </button>
                <button disabled={!hasImage} onClick={onCopyImageUrlClick} className="flex-1">
                    Copy URL
                </button>
            </div>
            <button disabled={!hasImage} onClick={onDownloadImageClick} className="framer-button-primary">
                Download
            </button>
        </div>
    )
}

function useSelection() {
    const [selection, setSelection] = useState([])

    useEffect(() => {
        if (framer.mode === "canvas") {
            return framer.subscribeToSelection(setSelection)
        }
    }, [])

    return selection
}

function useImage() {
    const [image, setImage] = useState(null)

    useEffect(() => {
        if (framer.mode === "canvas" || framer.mode === "editImage") {
            return framer.subscribeToImage(setImage)
        }
    }, [])

    return image
}
