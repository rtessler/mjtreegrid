# mjTreeGrid

A jquery plugin for rendering json data as tree grid of checkboxes, radiobuttons, images and text.

Examples:

http.www.multilistjs.com

# Documentation

## Options:

### Settings

Row data structure:

id:         int, mandatory. If omitted one will be generated
pid:         parent key field, default null
image:       string (default null)
selected:    true,false (ignored if show_checkbox is true, default false)
expanded:    true|false
checked:     0|1|2, 0 is not checked, 1 is checked, 2 is half ticked (ignored if show_checkbox is false)
disabled:    true or false (default false)

Node structure:

data    
parent
children
next
prev
visible

Column structure:

text
data_field
width
align                                (left,right,center) (default: left)    

## Example:

 var rows = [

     { id: "gibson", pid: null, text: "Gibson", image: "images/test.png", description: "big", width: width++, height: height++, expanded: true },
         {  id: "sg", pid: "gibson", text: "SG", description: "big", width: width++, height: height++ },
         {  id: "les paul", pid: "gibson", text: "Les Paul", description: "big", width: width++, height: height++ },
         {  id: "335", pid: "gibson", text: "335", description: "big", width: width++, height: height++ },
         {  id: "flying v", pid: "gibson", text: "Flying V", description: "big", width: width++, height: height++ },
         {  id: "robot", pid: "gibson", text: "Robot", description: "big", width: width++, height: height++ },

    { id: "fender", pid: null, text: "Fender", image: "images/test.png", description: "big", width: width++, height: height++ },

             { id: "electric", pid: "fender", text: "Electric", description: "big", width: width++, height: height++ },

                 { id: "stratocaster", pid: "electric", text: "Stratocaster", description: "big", width: width++, height: height++ },
                     { id: "colors", pid: "stratocaster", text: "Colors", description: "big", width: width++, height: height++ },
                         {  pid: "colors", text: "Sunburst", description: "big", width: width++, height: height++ },
                         {  pid: "colors", text: "White", description: "big", width: width++, height: height++ },
                     { id: "pickups", pid: "stratocaster", text: "Pickups", description: "big", width: width++, height: height++ },
                         {  pid: "pickups", text: "standard single coil", description: "big", width: width++, height: height++ },
                         {  pid: "pickups", text: "EMG", description: "big", width: width++, height: height++ },

                 {  pid: "electric", text: "Telecaster", description: "big", width: width++, height: height++ },

                 { id: "jaguar", pid: "electric", text: "Jaguar", description: "big", width: width++, height: height++ },
                     { id: "jcolors", pid: "jaguar", text: "Colors", description: "big", width: width++, height: height++ },
                     {  pid: "jcolors", text: "Sunburst", description: "big", width: width++, height: height++ },
                     {  pid: "jcolors", text: "Turquoise", description: "big", width: width++, height: height++ },
                     {  pid: "jcolors", text: "Black", description: "big", width: width++, height: height++ },

                ];

$(".widget").mjTreeGrid({
        rows: rows,
        columns: [{ data_field: "text", width: 100 }],
        show_borders: false
    });

$(".widget").on("selected", function (e, d) {

    console.log(d);
});

### Methods:

recurseChildren(node, callback)  // run a callback on every child node of a tree
recurseParents(node, callback)   // run a callback on every child node of a tree
getChildren(node)                // gets a nodes children as an array
getChildrenById(id)
getSiblings(node)
getRows()
getFilteredRows()
getScrollableRows()
getRowElement(node) // find the DOM .mj-row element for a node, if the row is not in the visible nodes return null
getRowElementById(id)   // returns the row element with data.d = id, if the row is not in the visible nodes return null
getRowById(id)
clear()                      // empty the data and list
search(search_function) // use user supplied function which returns true or false to test each object, returns an array of rows

// enable, disable functions

enableAll()
disableAll()
enable(node)
enableById(id)
enableAt(n)
disable(node)
disableById(id)
disableAt(n)

// checkbox functions         

checkAll()
uncheckAll() 
check(node, check_parents)
checkById(id)
uncheck(node)
uncheckById(id)
checkAt(n)
uncheckAt(n) 
getChecked()        // return array of checked nodes, does not return half ticked
getHalfTicked()     // return array of half checked nodes
halfTick(node)
halfTickById(id)
halfTickAt(n)
halfTickAll()
deselectHalfTicked()

// select functions

select(node, e)
selectById(id)
deselect(node, e)
deselectById(id) 
getSelected()
selectAll() 
deselectAll()
selectAt(n)
deselectAt(n)
sort(callback)
filter(val, callback) 

// add, insert, update, remove

insertRow(node, data)        // create a sibling node
insertRowById(id, data)
addRow(node, data)           // create a sibling node
addRowById(id, data) 
addRootNode(data) 
addChild(node, data) 
addChildById(id, data) 
updateRow(node, data)        // update a nodes data
updateRowById(id, data)
removeRow(node) 
removeRowById(id) 

// expand collapse functions

expand(node)     // in virtual mode the row may or may not be visible
expandById(id) 
collapse(node) 
collapseById(id) 
expandAll() 
collapseAll() 
getExpanded() 

// misc

close()  // dont clear the data, important to turn off events
isRowVisible: function(node)
isRowVisibleById(id) 
scrollToRow(node, animate) 
scrollToRowById(id, animate)
scrollToRowByIndex(n, animate) 
getRootRow(node) 
getRootRowById(id) 