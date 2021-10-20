let opcodes; // stores 8085 opcodes/instruction reference table
let stack = {}; // stores the 8-bit data in various memory locations
let currentState; // store the current state of the 8085 simulator window
let addr; // stores the address shown in the address screen
let data; // stores the data shown in the data screen
let state; // stores the various states of the address/data screen state
let pair; // stores 3 major register pairs as {reg: pair} eg: {'B': 'C'}
let reg; // stores the general purpose register values
let flags; // stores all the flags values
let interruptStat; // stores the enabled/disabled/pending states of the 8085 interrupts in decimal number format
let tableRows; // stores how many rows are to be displayed in the tables of Instruction Window
let searchList = {}; // stores a list of opcodes as {instruction: opcode} eg: {'HLT': 76}

/*
 * On keyboard-input-events inside the input-box in Opcode List window
 * the inputted value is searched through all the opcode lists and displays
 * a list of matched opcodes as a result.
 */
document.getElementById('searchbar').oninput = e => {
    let value = e.target.value.toUpperCase();
    
    // checks if inputted search value contains valid characters,
    // if it does not contain valid characters then replace
    // invalid characters with blank('') and prevents re-searching,
    // otherwise searching takes place
    if(/[^a-zA-Z0-9 ,]+/g.test(value)){ 
        e.target.value = value.replace(/[^a-zA-Z0-9 ,]+/g, '');
        return;
    }
    
    // display loading icon
    document.getElementById('loading-icon').style.display = 'block';
    
    setTimeout(() => {
        let list = document.querySelector('#oplist ul');
        list.innerHTML = '';
        for(let i in searchList) {
            const desc = opcodes[searchList[i]][2];
            
            // checking if `searchList` at `i` contains the searched value 
            if(i.indexOf(value) + 1)
                list.innerHTML += `<li class="op-item" title="${desc}">
                        <span class="code">${stringify(searchList[i], 2, true)}</span>
                        <span class="instruction">${i}</span>
                        <span class="info" data-desc="${desc}" tabindex="0">&#8505;</span>
                    </li>`;
        }
        
        // hiding loading icon
        document.getElementById('loading-icon').style.display = 'none';
    }, 500);
};

/*
  * This function is called whenever a click/mousedown on
  * document.body takes place
  */
document.body.onmousedown = e => {
    //disabling any/all right-click context-menus
    document.oncontextmenu = ev => {ev.preventDefault()};
    
    let x, y, dx, dy, el = e.target;
    
    // if a window is clicked then focusing it, bringing it on top
    // of other windows takes place and its dragging is handled here
    if(el.className == 'window' && e.offsetY < 1) {
        el.focus();
        e.preventDefault();
        dx = e.clientX;
        dy = e.clientY;
        document.onmouseup = ev => {document.onmouseup = document.onmousemove = null};
        
        // changing window positions when dragged
        document.onmousemove = ev => {
            ev.preventDefault();
            x = dx - ev.clientX;
            y = dy - ev.clientY;
            dx = ev.clientX;
            dy = ev.clientY;
            el.style.top = (el.offsetTop - y) + "px";
            el.style.left = (el.offsetLeft - x) + "px";
        };
    
        
    // if the minimized tabs are clicked then its corresponding window is opened
    } else if (el.parentElement.id == 'minitabs'){
        document.getElementById(el.dataset.window).style.visibility = 'visible';
        el.style.display = 'none';
        if(el.dataset.window == 'oplist')
            document.getElementById('searchbar').oninput({target: document.getElementById('searchbar'),});
        
        
    // if the info icon `i` is clicked on the Opcode List window then the
    // corresponding list's description's position is set based on mouse(X, Y)
    } else if(el.className == 'info'){
        el.style.setProperty('--top', e.y + 'px');
        el.style.setProperty('--left', e.x + 'px');
        
        
    // the opcode of an instruction from Opcode List window is
    // inputted on the screen when an opcode instruction is clicked
    } else if(el.className == 'op-item'){
        if(currentState == inputData)
            data = stringify(numerify(el.children[0].innerText), 2, true);
        document.getElementById('datasc').innerText = data;
        
        
    // if the minimize icon is clicked then that window is hidden
    // and its corresponding minimize-tab is displayed in the taskbar
    } else if (el.className == 'minimizer'){
        el.closest('.window').style.visibility = 'hidden';
        document.querySelector('div#minitabs > div[data-window=oplist]').style.display = 'inline-block';
        
        
    // mouse-action on all text input types are prevented
    } else if (el.type != "text")
        document.onmousemove = ev => {ev.preventDefault()};
    
    
    // de-focus all the Windows
    document.querySelectorAll('.window').forEach(elm => {
        elm.style.borderColor = '#aec7e1';
        elm.style.zIndex = 3;
    });
    
    // apply focus effect only on Windows whose children or the window itsef is clicked
    if(e.target.closest('.window')){
        let cw = e.target.closest('.window');
        cw.style.borderColor = '#78a9dc';
        cw.style.zIndex = 4;
    }
};



/*
 * On clicking any of the buttons 'APPLY', 'DEFAULT' or 'DONE' in
 * the 'Show ROW' dialog box the required actions takes place and
 * the rows in the Instruction Window are updated accordingly.
 */
document.getElementById('buttons-container').onclick = e => {
    let inputs = Array.from(document.querySelectorAll('#row-data-container input'));
    switch(e.target.innerText){
            
        // setting `tableRows` variable and applying changes and cleaing rows
        case "APPLY":
            tableRows = [parseInt(inputs[0].value), parseInt(inputs[1].value)];
            clearTable([true, true]);
            break;
            
        // only placing default values in input-boxes not applying it
        case "DEFAULT":
            inputs[0].value = 100;
            inputs[1].value = 25;
            break;
            
        // only closing the window and not applying changes
        case "DONE":
            e.target.offsetParent.style.display = 'none';
            break;
    }
};


/*
 * On clicking 'Show ROW' button in Instructions Window displays
 * a dialog box which allows us to determine the maximum rows on
 * both the tables on the Window.
 */
document.getElementById('show-row').onclick = e => {
    let dialog = document.getElementById('row-data-container');
    dialog.style.display = 'block';
    dialog.style.zIndex = 6;
    document.getElementById('debugform').style.borderColor = '#aec7e1';
    dialog.style.borderColor = '#78a9dc';
};

/*
 * This function clears all the table values in the debug window.
 * 
 * The parameter `sel` is an array which stores boolean values 
 * that determines which table in debug window is to be cleared.
 * 
 * sel = [true, false] determines that only First table will be cleared.
 */
function clearTable(sel = [true, true]) {
    var backup;
    const tables = ['#debug', '#stack'];

    for (let i = 0; i < sel.length; i++) {
        if (!sel[i])
            tables[i] = null;
    }
    if(sel[0])
        document.getElementById('row-selector').innerHTML = '';
    for (let i = 0; i < tables.length; i++) {
        if (tables[i] === null)
            continue;
        backup = document.querySelector('div' + tables[i] + '.table-container tr');
        document.querySelectorAll('div.table-container tbody')[i].innerHTML = "";
        document.querySelectorAll('div.table-container tbody')[i].appendChild(backup);
    }

    for (let i = 0; i < tables.length; i++) {
        if (tables[i] === null)
            continue;
        for (let j = 0; j < tableRows[i]; j++) {
            var tr = document.createElement("TR");
            tr.innerHTML = i ? '<td></td><td></td>' : '<td class="a"></td><td class="o"></td><td class="i"></td><td class="b"></td>';
            document.querySelectorAll('div.table-container tbody')[i].appendChild(tr); + '</option>';
            if (i == 0)
                document.getElementById('row-selector').innerHTML += '<option value="' + (j + 1) + '">' + (j + 1);
        }
    }
    document.querySelectorAll('#stack tr')[1].children[0].innerText = '8421';
    document.querySelectorAll('#stack tr')[1].children[1].innerText = 'XX';
}

/*
 * This function is used to move to the next or previous address,
 * or move from address input state to opcode/data input state.
 *  
 * The parameter `v` has either `-1` or `1` integer value,
 * which determines to move to next state or the previous one.
 * 
 * if Address = a
 * then v = 1   will move to address a + 1, and
 *      v = -1  will move to address a - 1.
 * If user is supposed to input address then this function will cause
 * the user to input the data next time onwards.
 */
function stateShift(v) {
    if (addr == state.RESET[0] || addr == state.EXECUTED[0] || addr == state.ERROR[0]) {
        addr = state.ERROR[0];
        data = state.ERROR[1];
        currentState = () => {};
    } else {
        var decimal = parseInt(addr, 16);
        if (currentState != inputAddress) {
            stack[decimal] = data;
            addr = ((0x10000 + (decimal + v)) % 0x10000).toString(16).toUpperCase();
            addr = "0000".slice(addr.length) + addr;
            data = stack[decimal + v] ? stack[decimal + v] : "00";
        } else
            data = stack[decimal] ? stack[decimal] : "00";
        data = "00".slice(data.length) + data;
        currentState = inputData;
    }
}

/*
 * This function is used set state of the virtual microprocessor.
 * 
 * The parameter `stateId` is the state that is received when the,
 * user clicks on any operational keys (e.g. 'kbint', 'Reset' and all those).
 * 
 * The parameter `value` is the value passed with the state(if any).
 * `value` is meant to be passed to the `currentState` function in
 * the default case
 */
function setState(stateId, value = "") {
    switch (stateId) {
        case "res":
            addr = state.RESET[0];
            data = state.RESET[1];
            currentState = () => {};
            break;
        case 'bin':
            // function not known yet
            break;
        case 'exm':
            if (addr === state.RESET[0] || addr === state.ZERO[0]) {
                addr = state.ZERO[0];
                data = state.ZERO[1];
                currentState = inputAddress;
            } else {
                addr = state.ERROR[0];
                data = state.ERROR[1];
                currentState = () => {};
            }
            break;
        case 'pre':
            stateShift(-1);
            break;
        case 'nxt':
            stateShift(1);
            break;
        case 'exr':
            if (addr === state.RESET[0] || addr === state.ZERO[0]) {
                addr = state.ZERO[0];
                data = state.ZERO[1];
                currentState = inputAddress;
            } else {
                addr = state.ERROR[0];
                data = state.ERROR[1];
                currentState = () => {};
            }
            break;
        case 'goo':
            addr = state.ZERO[0];
            data = state.ZERO[1];
            currentState = inputAddress;
            break;
        case 'exe':
            var ad = Number("0x" + addr);
            if (!isNaN(ad))
                execute(ad);
            else {
                addr = state.ERROR[0];
                data = state.ERROR[1];
                currentState = () => {};
            }
            break;
        default:
            currentState(value);
    }
    document.getElementById('addrsc').innerText = addr;
    document.getElementById('datasc').innerText = data;
}

/*
 * This function affects the address variable with the
 * value passed to it.
 */
function inputAddress(value) {
    addr = addr.slice(1) + value;
}

/*
 * This function affects the data/opcode-instruction variable with the
 * value passed to it.
 */
function inputData(value) {
    data = data.slice(1) + value;
}

/*
 * Anytime a button is clicked from the keypad the `setState`
 * function is called along with the corresponding values passed
 */
document.getElementById('keypad-container').addEventListener("click", e => {
    if (e.target.tagName === "BUTTON") 
        setState((e.target.value.length > 0) ? e.target.value : e.target.innerText, e.target.innerText);
});

/*
 * Every time a keyboard-input takes place with active/focussed
 * element being the 8085 Window, this function is called.
 */
document.body.onkeydown = e => {
    if(document.activeElement != document.querySelector('#w8085'))
        return;
        
    if(e.key == " ")
        e.preventDefault();
    
    // checks if the keypressed-character is a hexadecimal character
    // if it is one then the character is passed to the `currentState` function
    // and the DOM screens are updated and button pressed effect is applied
    // to the button which corresponds to the inputted character
    if (/^[A-F0-9a-f]$/g.test(e.key)){
        currentState(e.key.toUpperCase());
        document.getElementById('addrsc').innerText = addr;
        document.getElementById('datasc').innerText = data;
        let n = parseInt(e.key, 16) + 1;
        let el = document.getElementById('keyvals').children[4 - Math.ceil(n/4)].children[(n - 1) % 4];
        el.style.borderStyle = 'inset';
        el.style.backgroundImage = 'linear-gradient(180deg, lightgray, transparent)';
        
    // if the keypressed-character is not a hexadecimal character then a
    // corresponding `setState` function(if any) related to the character
    // is called along with a button pressed effect
    } else {
        let elemval;
        switch(e.key){
            case "ArrowLeft": elemval = "pre"; break;
            case "ArrowRight": elemval = "nxt"; break;
            case "Delete": elemval = "res"; break;
            case "*": elemval = "bin"; break;
            case "+": elemval = "exm"; break;
            case "-": elemval = "exr"; break;
            case " ": elemval = "goo"; break;
            case "Enter": elemval = "exe"; break;
            default: elemval = null;
        }
        if(elemval != null) {
            let el = document.querySelector(`button.key[value="${elemval}"]`);
            el.style.borderStyle = 'inset';
            el.style.backgroundImage = 'linear-gradient(180deg, lightgray, transparent)';
            setState(elemval);
        }
    }
};

/*
 * Button/Key press effect from all buttons in the keypad are cleared on keyup
 */
document.body.onkeyup = e => {
    Array.from(document.querySelectorAll('button.key')).forEach(el => {
        el.style.borderStyle = 'outset';
        el.style.backgroundImage = 'none';
    });
};

/*
 * This function returns parity state of an integer or a
 * hexadecimal(string) value passed as `val` parameter.
 *
 * The function return `true` if parity is 1 otherwise
 * it returns `false`.
 */
function getParity(val) {
    let binary;
    if (typeof val === "string")
        binary = Number("0x" + val.slice(-2));
    else
        binary = val % 0x100;
    return binary.toString(2).split('').reduce((t, e) => t + Number(e), 0) % 2 == 0;
}

/*
 * This function is a shortcut for setting the flag values of the virtual
 * microprocessor by passing it as arguments/parameters 
 * 
 * if setFlags(0xFF, true) is called the flag values will the calculated
 * based on 0xFF and only flag auxialliary carry will be set based on
 * second argument which is `true`.
 * 
 * if setFlags(0x1A, undefined) is called the flag values will the
 * calculated based on 0x1A and only flag auxialliary carry will not
 * be altered as the second argument is `undefined`.
 * 
 * if setFlags(true, true, false, true, false) is called
 * the flag values will be set orderly as follows:
 *   flag s <- true,
 *   flag z <- true,
 *   flag ac <- false,
 *   flag p <- true,
 *   flag cy <- false
 */
function setFlags() {
    if (arguments.length <= 2 && typeof arguments[0] == "number") {
        arguments[0] %= 0x100;
        flags.s = (arguments[0] & 0b10000000) > 0;
        flags.z = arguments[0] == 0;
        flags.cy = arguments[0] > 0xFF;
        if (arguments[1] != undefined)
            flags.ac = arguments[1];
        flags.p = getParity(arguments[0]);
    } else {
        for (let a = 0, f = Object.keys(flags); a < arguments.length; a++)
            flags[f[a]] = (arguments[a] === null) ? flags[f[a]] : (arguments[a] ? true : false);
    }
}

/*
 * This function converts a number into a hexadecimal number returns it
 * as a string.
 * 
 * The parameter `value` is the integer number passed that is to be converted.
 * The optional parameter `digits` denotes how long would the returned
 * string be. (default = 2)
 * The optional parameter `toUpper` denotes if the returned string should be in
 * Uppercase. (default = false)
 */
function stringify(value, digits = 2, toUpper = false) {
    if (toUpper)
        return ((10 ** digits) + (value).toString(16).toUpperCase()).slice(-digits);
    return ((10 ** digits) + (value).toString(16)).slice(-digits);
}

/*
 * This function converts the hexadecimal-number(s) passed as
 * strings returns it as an integer number.
 * Note: all the hexadecimal numbers are concatenated to form one big hexadecimal-
 * number string which is what is converted to integer.
 * 
 * The optional parameter `digits` denotes how many digits should all the passed
 * hexadecimal-numbers(originally passed as string) be treated as. (default = 2)
 * The parameter `values` is a list of hexadecimal-number(as string) to be converted.
 * 
 * numerify(2, "AC", "F", "01A") will return 0xAC0F1A
 * numerify(3, "AC", "F", "21A") will return 0x0AC00F21A
 * numerify("AC", "F", "288") will return 0xAC0F88
 * numerify("AC", "0", "2488") will return 0xAC0088
 */
function numerify(digits = 2, ...values) {
    if (typeof digits !== "number") {
        values.unshift(digits);
        digits = 2;
    }
    return parseInt(values.map(e => e.slice(-digits).padStart(digits, "0").join(""), 16);
    // return parseInt(values.reduce((t, e) => t + ((10 ** digits) + "").slice(e.length + 1) + e, ""), 16);
}

/* 
 * This function is called whenever the 'Exec' button is triggered.
 * It executes all the instructions starting from the `address`
 * parameter until an 'HLT' instruction is reached or no more rows
 * in the table are left.
 * It also updates the DOM with all the instructions that it comes
 * across during the execution of the program.
 */
function execute(address) {
    clearTable([true, false]);
    var end = false;
    var index = 1;
    var tr;
    var readValue = "";
    var instruction = "";
    var skip = false;
    const t = document.querySelectorAll('#debug tr');
    while (!end) {
        tr = t[index++];
        var hexData = Number("0x" + stack[address]).toString(16).toUpperCase();
        tr.children[0].innerText = stringify(address, 4, true);
        tr.children[1].innerText = stack[address] ? stack[address] : "00";

        end = stack[address] == '76' || index > tableRows[0];
        if(stack[address - 1] == stack[address] && stack[address] == undefined) {
            end = true;
            addr = state.ERROR[0];
            data = state.ERROR[1];
            currentState = () => {};
        }
        address++;

        if (!skip) {
            instruction = opcodes[hexData] ? opcodes[hexData][0] : "NOP";
            tr.children[2].innerText = instruction;
            tr.children[3].innerText = opcodes[hexData] ? opcodes[hexData][1] : 1;
            tr.children[2].setAttribute('title', opcodes[hexData] ? opcodes[hexData][2] : "No Operation");
            readValue = "";
        } else
            readValue = stack[address - 1] + readValue;
        skip = operation(instruction, readValue, address - 1, a => {
            address = a
        });
    }
    if(addr != state.ERROR[0]){
        addr = state.EXECUTED[0];
        data = state.EXECUTED[1];
    }
    tr.style.textShadow = '0 0 0 blue';
}

/*
 * This function is where each function of each instruction is 
 * defined and executed when called by `execute` function.
 * 
 * the `instruction` parameter is the instruction whose
 * function is to be executed.
 * the `value` parameter is the user-entered custom values
 * which goes with the instruction passed.
 * the `address` parameter is the current address in the memory
 * from which the instruction is called.
 * the `setAddress` parameter is a function which is used to set
 * the subroutine address of the next instruction to be executed.
 */
function operation(instruction, value, address, setAddress) {
    let tokens;
    if (instruction.indexOf(' ') + 1)
        tokens = instruction.trim().replace(instruction.split(' ')[1], instruction.split(' ')[1].toLowerCase()).split(/\s|,/g);
    else
        tokens = [instruction.trim()];
    if (/^[^L].+I$|^IN$|OUT/g.test(tokens[0]) && value.length != 2)
        return true;
    if (/^[SLCJ]/g.test(tokens[0]) && !/CM[APC]|PI|DAX|S[^HT]|TC/g.test(tokens[0]) && value.length != 4)
        return true;
    let skip = false;
    
    let numericVal = numerify(value);
    let sum;
    switch (tokens[0]) {
        // Control Unit Instructions
        case 'NOP':
        case 'HLT':
            skip = false;
            break;
        case 'DI':
            reg.ie = 0;
            break;
        case 'EI':
            reg.ie = 1;
            break;
        case 'RIM':
            //to be checked
            break;
        case 'SIM':
            //to be checked
            break;
            // Control Unit Instructions End

            // Logical Instructions
        case 'CMP':
            setFlags(((reg.a - reg[tokens[1]]) & 0b10000000) > 0, reg.a == reg[tokens[1]], false, getParity(reg.a - reg[tokens[1]] + 0x100), reg.a < reg[tokens[1]]);
            //recheck for parity and auxillary flag
            break;
        case 'CPI':
            setFlags(((reg.a - numericVal) & 0b10000000) > 0, reg.a == numericVal, false, getParity(reg.a - numericVal + 0x100), reg.a < numericVal);
            //recheck for parity and auxillary flag
            break;
            /*case 'ANA':
                reg.a &= reg[tokens[1]];
                setFlags(reg.a, true);
                break;
            case 'ANI':
                reg.a &= numericVal;
                setFlags(reg.a, true);
                break;
            case 'XRA':
                reg.a ^= reg[tokens[1]];
                setFlags(reg.a, false);
                break;
            case 'XRI':
                reg.a ^= numericVal;
                setFlags(reg.a, false);
                break;
            case 'ORA':
                reg.a |= reg[tokens[1]];
                setFlags(reg.a, false);
                break;
            case 'ORI':
                reg.a |= numericVal;
                setFlags(reg.a, false);
                break;*/
        case 'RLC':
            reg.a <<= 1;
            flags.cy = reg.a > 0xFF;
            reg.a |= flags.cy ? 1 : 0;
            break;
        case 'RRC':
            flags.cy = reg.a & 1 > 0;
            reg.a >>= 1;
            reg.a |= flags.cy ? 0b10000000 : 0;
            break;
        case 'RAL':
            reg.a <<= 1;
            reg.a |= flags.cy ? 1 : 0;
            flags.cy = reg.a > 0xFF;
            break;
        case 'RAR':
            reg.a |= flags.cy ? 0b100000000 : 0;
            flags.cy = reg.a & 1 > 0;
            reg.a >>= 1;
            break;
        case 'CMA':
            reg.a = Number("0b" + ("00000000" + reg.a.toString(2)).slice(-8).split('').reduce((t, e) => t + ((Number(e) ? "0" : "1")), ""));
            break;
        case 'CMC':
            flags.c = !flags.c;
            break;
        case 'STC':
            flags.cy = true;
            break;
            // Logical Instructions End


            // Branching Instructions
        case 'PCHL':
            reg.pc = numerify(stringify(reg.h), stringify(reg.l));
            break;
        case 'RST': //recheck for stack pointer operation
            let ad = stringify(address + 1, 4, true);
            stack[--reg.sp] = ad.substr(-4, 2);
            stack[--reg.sp] = ad.substr(-2, 2);
            /*
            mainStack.push([mainStack.slice(-1)[0][0] - 1, ad.substr(-4, 2)]);
            mainStack.push([mainStack.slice(-1)[0][0] - 1, ad.substr(-2, 2)]);*/
            setAddress(Number(tokens[1]) * 8);
            //setReturnAddress(address+1);
            break;
            // Branching Instructions End

            // Arithmetic Instructions
            /*case 'ADD':
                reg.a += reg[tokens[1]];
                setFlags(reg.a, (((reg.a - reg[tokens[1]]) & 0xF) + (reg[tokens[1]] & 0xF)) > 0xF);
                break;
            case 'ADC': //needs to be rechecked
                reg.a += reg[tokens[1]] + flags.cy;
                setFlags(reg.a, (((reg.a - reg[tokens[1]] - flags.cy) & 0xF) + ((reg[tokens[1]] + flags.cy) & 0xF)) > 0xF);
                //every time sign bit are set if MSB(b7) is `1` so recheck all instructions
                break;
            case 'ADI':
                reg.a += numericVal;
                setFlags(reg.a, (((reg.a - numericVal) & 0xF) + (numericVal & 0xF)) > 0xF);
                break;
            case 'ACI': 
                reg.a += numericVal + flags.cy;
                setFlags(reg.a, (((reg.a - numericVal - flags.cy) & 0xF) + ((numericVal + flags.cy) & 0xF)) > 0xF);
                break;*/
        case 'DAD':
            if (tokens[1] == "sp")
                sum = stringify(numerify(stringify(reg.h), stringify(reg.l)) + numerify(4, stringify(reg.sp, 4)), 4);
            else
                sum = stringify(numerify(stringify(reg.h), stringify(reg.l)) + numerify(stringify(reg[tokens[1]]), stringify(reg[pair[tokens[1]]])), 4);
            reg.h = numerify(sum.substr(-4, 2));
            reg.l = numerify(sum.substr(-2, 2));
            flags.cy = false;
            break;
            /*case 'SUB':
                reg.a = (reg.a - reg[tokens[1]] + 0x100) % 0x100;
                setFlags(reg.a);
                break;
            case 'SBB':    //recheck this and other commands for borrow flag manipulation
                reg.a = (reg.a - reg[tokens[1]] - flags.cy + 0x100) % 0x100;
                setFlags(reg.a);
                break;
            case 'SUI':
                reg.a = (reg.a - numericVal + 0x100) % 0x100;
                setFlags(reg.a);
                break;
            case 'SBI':
                reg.a = (reg.a - numericVal - flags.cy + 0x100) % 0x100;
                setFlags(reg.a);
                break;*/
        case 'INR':
            reg[tokens[1]] += 1;
            setFlags(reg[tokens[1]] & 0x80 > 0, reg[tokens[1]] == 0, (((reg[tokens[1]] - 1) & 0xF) + 1) > 0xF, getParity(reg[tokens[1]]), null);
            break;
        case 'INX': //check for INX SP
            if (tokens[1] == "sp")
                sum = stringify(numerify(4, stringify(reg.sp, 4)) + 1, 4);
            else
                sum = stringify(numerify(stringify(reg[tokens[1]]), stringify(reg[pair[tokens[1]]])) + 1, 4);

            reg[tokens[1]] = numerify(sum.substr(-4, 2));
            reg[pair[tokens[1]]] = numerify(sum.substr(-2, 2));
            break;
        case 'DCR':
            reg[tokens[1]] = (reg[tokens[1]] - 1 + 0x100) % 0x100; //`- 1 + 0x100` is to round off to 'FF'
            setFlags(reg[tokens[1]] & 0x80 > 0, reg[tokens[1]] == 0, (((reg[tokens[1]] + 1) & 0xF) + 0xF) > 0xF, getParity(reg[tokens[1]]), null);
            break;
        case 'DCX': //check for DCX SP
            if (tokens[1] == "sp")
                sum = stringify(numerify(4, stringify(reg.sp, 4)) - 1 + 0x10000, 4);
            else
                sum = stringify(numerify(stringify(reg[tokens[1]]), stringify(reg[pair[tokens[1]]])) - 1 + 0x10000, 4);
            reg[tokens[1]] = numerify(sum.substr(-4, 2));
            reg[pair[tokens[1]]] = numerify(sum.substr(-2, 2));
            break;
        case 'DAA':
            //recheck considering the use of Auxillary Flag and Carry Flag
            flags.ac = reg.a & 0xF > 9;
            flags.cy = (reg.a >> 4) + flags.ac > 0xF;
            reg.a += numerify(stringify(reg.a).replace(/\d/g, "0").replace(/[a-fA-F]/g, "6"));
            break;
            // Arithmetic Instructions End

            // Data-transfer Instructions
        case 'MOV':
            reg[tokens[1]] = reg[tokens[2]];
            break;
        case 'MVI':
            reg[tokens[1]] = numericVal;
            break;
        case 'LDA':
            let v = numerify(stack[numericVal]);
            reg.a = v | 0x00;
            break;
        case 'LDAX':
            reg.a = numerify(stack[numerify(stringify(reg[tokens[1]]), stringify(reg[pair[tokens[1]]]))]);
            break;
        case 'LXI': //check for LXI SP
            if (tokens[1] == 'sp')
                reg.sp = numerify(value);
            else {
                reg[tokens[1]] = numerify(value.substr(0, 2));
                reg[pair[tokens[1]]] = numerify(value.substr(2, 2));
            }
            break;
        case 'LHLD':
            reg.l = numerify(stack[numericVal]);
            reg.h = numerify(stack[numericVal + 1]);
            break;
        case 'STA':
            stack[numericVal] = stringify(reg.a, 2, true);
            break;
        case 'STAX':
            stack[numerify(stringify(reg[tokens[1]]), stringify(reg[pair[tokens[1]]]))] = stringify(reg.a, 2, true);
            break;
        case 'SHLD':
            stack[numericVal] = stringify(reg.l, 2, true);
            stack[numericVal + 1] = stringify(reg.h, 2, true);
            break;
        case 'XCHG':
            let hold = reg.h;
            reg.h = reg.d;
            reg.d = hold;
            hold = reg.l;
            reg.l = reg.e;
            reg.e = hold;
            break;
        case 'SPHL':
            reg.sp = numerify(stringify(reg.h), stringify(reg.l));
            break;
        case 'XTHL':
            let temp = numerify(4, stack[reg.sp]);
            stack[reg.sp] = stringify(reg.l, 2, true);
            reg.l = temp;
            temp = numerify(4, stack[reg.sp + 1]);
            stack[reg.sp + 1] = stringify(reg.h, 2, true);
            reg.h = temp;
            break;
        case 'PUSH':
            if (reg[tokens[1]] == 'psw') {
                stack[--reg.sp] = stringify([flags.s, flags.z, flags.u1, flags.ac, flags.u2, flags.p, flags.u3, flags.cy].reduce((t, e, i, a) => t + (e ? 2 ** (a.length - i - 1) : 0), 0), 2, true);
                stack[--reg.sp] = stringify(reg.a);
                /*mainStack.push([mainStack.slice(-1)[0][0] - 1, stringify([flags.s, flags.z, flags.u1, flags.ac, flags.u2, flags.p, flags.u3, flags.cy].reduce((t, e, i, a) => t + (e ? 2**(a.length - i - 1) : 0), 0), 2, true)]);
                mainStack.push([mainStack.slice(-1)[0][0] - 1, stringify(reg.a)]);*/
            } else {
                stack[--reg.sp] = stringify(reg[pair[tokens[1]]]);
                stack[--reg.sp] = stringify(reg[tokens[1]]);
                /*mainStack.push([mainStack.slice(-1)[0][0] - 1, stringify(reg[pair[tokens[1]]])]);
                mainStack.push([mainStack.slice(-1)[0][0] - 1, stringify(reg[tokens[1]])]);*/
            }
            break;
        case 'POP':
            if (reg[tokens[1]] == 'psw') {
                reg.a = numerify(stack[reg.sp]);
                delete stack[reg.sp++];
                let p = numerify(stack[reg.sp]);
                delete stack[reg.sp++];
                /*reg.a = numerify(mainStack.pop()[1]);
                let p = numerify(mainStack.pop()[1]);*/
                setFlags(p & 0x80, p & 0x40, p & 0x10, p & 0x4, p & 0x1, p & 0x20, p & 0x8, p & 0x2);
            } else {
                reg[tokens[1]] = numerify(stack[reg.sp]);
                delete stack[reg.sp++];
                reg[pair[tokens[1]]] = numerify(stack[reg.sp]);
                delete stack[reg.sp++];
                /*reg[tokens[1]] = numerify(mainStack.pop()[1]);
                reg[pair[tokens[1]]] = numerify(mainStack.pop()[1]);*/
            }
            break;
        case 'OUT': //test for one byte input instruction done already just need to insert its function
            stack[numericVal] = stringify(reg.a, 2, true);
            break;
        case 'IN': //test for one byte input instruction done already just need to insert its function
            reg.a = numerify(stack[numericVal]);
            break;
            // Data-transfer Instructions End

        default:
            if (tokens[0].startsWith('J')) { // identifies JMP, JC, JNC, JP, JM, JZ, JNZ, JPE and JPO instructions i.e. jump instructions
                var f = true;
                switch (tokens[0]) {
                    case 'JMP': f = true; break;
                    case 'JC': f = flags.cy ;break;
                    case 'JNC': f = !flags.cy; break;
                    case 'JP': f = !flags.s; break;
                    case 'JM': f = flags.s; break;
                    case 'JZ': f = flags.z; break;
                    case 'JNZ': f = !flags.z; break;
                    case 'JPE': f = flags.p; break;
                    case 'JPO': f = !flags.p; break;
                }
                if (f)
                    setAddress(numerify(4, value));
            } else if (!/^[^C]|^C[MP][^OE]$/g.test(tokens[0])) { // identifies CALL, CC, CNC, CP, CM, CZ ,CNZ ,CPE and CPO instructions i.e. call instructions
                var f = true;
                switch (tokens[0]) {
                    case 'CALL': f = true; break;
                    case 'CC': f = flags.cy; break;
                    case 'CNC': f = !flags.cy; break;
                    case 'CP': f = !flags.s; break;
                    case 'CM': f = flags.s; break;
                    case 'CZ': f = flags.z; break;
                    case 'CNZ': f = !flags.z; break;
                    case 'CPE': f = flags.p; break;
                    case 'CPO': f = !flags.p; break;
                }
                if (f) {
                    let ad = stringify(address + 3, 2, true);
                    stack[--reg.sp] = ad.substr(-4, 2);
                    stack[--reg.sp] = ad.substr(-2, 2);
                    setAddress(numerify(4, value));
                }
            } else if (/^R[^LRAIS]/g.test(tokens[0])) { // identifies RET, RC, RNC, RP, RM, RZ, RNZ, RPE and RPO instructions i.e. all return instructions
                var f;
                switch (tokens[0]) {
                    case 'RET': f = true; break;
                    case 'RC': f = flags.cy; break;
                    case 'RNC': f = !flags.cy; break;
                    case 'RP': f = !flags.s; break;
                    case 'RM': f = flags.s; break;
                    case 'RZ': f = flags.z; break;
                    case 'RNZ': f = !flags.z; break;
                    case 'RPE': f = flags.p; break;
                    case 'RPO': f = !flags.z; break;
                }
                
                // if flag `f` is `true` then the Program-Stack goes to the previus calling address
                if (f) {
                    setAddress(numerify(stack[reg.sp + 1], stack[reg.sp]));
                    delete stack[reg.sp++];
                    delete stack[reg.sp++];
                }
            } else if (/^[ASXO][^TA][IA-D]$/g.test(tokens[0])) { // identifies all add/subtract/and/or/xor operations i.e. almost all logical and arithmetical operations
                var a = reg.a,
                    b = /I$/g.test(tokens[0]) ? numericVal : reg[tokens[1]]; // identifies ACI, ADI, SUI, SBI, ANI, ORI and XRI operations i.e. all Immediate addressing mode instructions
                b += (/C|SB/g.test(tokens[0]) && flags.c) ? 1 : 0; // identifies ACI, ADC, SBB and SBI operations that involves 'carry' or 'borrow'
                if (/N/g.test(tokens[0])) { // identifies ANA and ANI i.e. and operations
                    flags.ac = true;
                    reg.a &= b;
                    flags.cy = false;
                } else if (/O/g.test(tokens[0])) { // identifies ORA and ORI i.e. or operations
                    flags.ac = flags.cy = false;
                    reg.a |= b;
                } else if (/X/g.test(tokens[0])) { // identifies XRA and XRI i.e. xor operations
                    flags.ac = flags.cy = false;
                    reg.a ^= b;
                } else if (/[CD]/g.test(tokens[0])) { // identifies ACI, ADC, ADD and ADI i.e. add operations
                    reg.a += b;
                    flags.ac = ((a & 0xF) + (b & 0xF)) > 0xF;
                    flags.cy = reg.a > 0xFF;
                } else if (/S/g.test(tokens[0])) { // identifies SUB, SUI, SBB and SBI i.e. sub operations
                    reg.a -= b;
                    flags.ac = ((a & 0xF) + ((-b + 0x100) & 0xF)) > 0xF;
                    flags.cy = a < b;
                }
                reg.a = (reg.a + 0x100) % 0x100;
                // if(/*/I$/g.test(tokens[0]) &&*/ /[hl]/g.test(tokens[1]))
                //   reg.m = numerify(stack[numerify(stringify(reg.h), stringify(reg.l))]);
                flags.s = reg.a & 0b10000000 > 0;
                flags.z = reg.a == 0;
                flags.p = getParity(reg.a);
            }
    }
    //recheck for all commands that goes with H and L
    //recheck for parity, carry, sign, etc flags
    //recheck for sign flags in logical operations

    if (/[hl]/g.test(tokens[1]))
        reg.m = numerify(stack[numerify(stringify(reg.h), stringify(reg.l))]) | 0;
    else if (tokens[1] == 'm')
        stack[numerify(stringify(reg.h), stringify(reg.l))] = stringify(reg.m, 2, true);

    // updating Program-Stack data into the stack table in DOM
    for (let i = 0x8420; i >= reg.sp; i--) {
        document.querySelectorAll('#stack tr')[0x8422 - i].children[0].innerText = stringify(i, 4, true);
        document.querySelectorAll('#stack tr')[0x8422 - i].children[1].innerText = stack[i];
    }
    
    // refresh/clear stack table when 
    if (reg.sp == 0x8421)
        clearTable([false, true]);

    // updating flag values in DOM from `flags` object variable
    for (let f in flags)
        document.getElementsByClassName(f + '-flag')[0].innerText = flags[f] ? 1 : 0;

    // updating register values in DOM from `reg` object variable
    reg.pc = address + 1;
    for (let r in reg) {
        reg[r] %= Object.keys(reg).indexOf(r) < 9 ? 0x100 : 0x10000;
        let val = stringify(reg[r], (Object.keys(reg).indexOf(r) < 9) ? 2 : 4, true);
        if (r == 'ie')
            val = val.slice(-1);
        document.getElementsByClassName('ivalue ' + r + '-reg')[0].innerText = val;
    }
    return skip;
}

/*
 * This function is used to initialize the Simulator with all the
 * required properties and global variables.
 */
function init() {
    // default table rows count
    tableRows = [100, 25];

    // document.body.style.setProperty('--min', '0px');
    
    // setting   TRAP,  RST5.5,  RST6.5,  RST7.5  interrupt addresses to `00`
    stack[0x0024] = stack[0x002C] = stack[0x0034] = stack[0x003C] = "00";

    // setting masking of all interrupts to `0`
    interruptStat = 0;

    // setting global state values
    state = {
        EXECUTED: ["E", "  "],
        ERROR: ["-ERR", "  "],
        RESET: ["-MPS", "85"],
        ZERO: ["0000", "00"]
    }

    // initializing register values
    reg = {
        a: 0x00,
        b: 0x00,
        c: 0x00,
        d: 0x00,
        e: 0x00,
        h: 0x00,
        l: 0x00,
        m: 0x00,
        ie: 0x0,
        pc: 0x0000,
        sp: 0x8421
    };
    
    // initializing register pairs object
    let pair = {
        b: 'c',
        d: 'e',
        h: 'l',
    };

    // initializing flag values
    flags = {
        s: false,
        z: false,
        ac: false,
        p: false,
        cy: false,
        u1: false,
        u2: false,
        u3: false,
    };

    // fetching opcode JSON data from `opcodes.json` file
    searchList = {};
    fetch('./assets/opcodes.json')
        .then(response => response.json())
        .then(data => {
            opcodes = data;
            Object.keys(data).forEach(e => {searchList[data[e][0]] = e})
        });

    // setting all 3 Tables to prevent Keyboard Input Event
    document.getElementsByTagName('table')[0].onkeydown = document.getElementsByTagName('table')[1].onkeydown = document.getElementsByTagName('table')[2].onkeydown = e => {
        e.preventDefault()
    };

    // setting initial address and data values and reflecting it on DOM
    document.getElementById('addrsc').innerText = addr = state.RESET[0];
    document.getElementById('datasc').innerText = data = state.RESET[1];

    // initializing current state function to a void function
    currentState = () => {};

    // updating/reflecting flag values in DOM
    for (let f in flags)
        document.getElementsByClassName(f + '-flag')[0].innerText = flags[f] ? 1 : 0;

    // updating/reflecting register values in DOM from `reg` object variable
    for (let r in reg) {
        reg[r] %= Object.keys(reg).indexOf(r) < 9 ? 0x100 : 0x10000;
        let val = stringify(reg[r], (Object.keys(reg).indexOf(r) < 9) ? 2 : 4);
        if (r == 'ie')
            val = val.slice(-1);
        document.getElementsByClassName('ivalue ' + r + '-reg')[0].innerText = val;
    }

    // clearing all tables into fresh tables
    clearTable();

    // shaping hexadecimal keypad to a square-ish size
    document.getElementById('keyvals').style.height = (document.getElementById('keyvals').clientWidth - 40) + 'px';
    
    // repositioning debug window when site is opened via mobile-device(i.e. when innerWidth > innerHeight)
    document.getElementById('debugform').style.left = window.innerWidth > window.innerHeight ? document.getElementById('w8085').offsetWidth + 'px' : '0px';
    document.getElementById('debugform').style.top = window.innerHeight >= window.innerWidth ? document.getElementById('w8085').offsetHeight + 'px' : '0px';
}

init();
