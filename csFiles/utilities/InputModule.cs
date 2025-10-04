using System.Collections.Generic;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;


public class InputModule : StandaloneInputModule
{
    public Vector2 m_cursorPos = Vector2.zero;// the new cursor position 
    public PointerEventData data;
   
    protected override void Start()
    {
        base.Start();
        GetPointerData(0, out data, true); // feeds a stream of data i can access
    }

    void FixedUpdate() => UpdateCursorPosition(Input.mousePosition * (180f / Screen.height));     
    public void UpdateCursorPosition(Vector2 a_pos) =>  m_cursorPos = a_pos;  // Hand this function your fake mouse position (in screen coords)


    // This is the real function we want, the two commented out lines (Input.mousePosition) are replaced with m_cursorPos (our fake mouse position, set with the public function, UpdateCursorPosition)
    private readonly MouseState m_MouseState = new MouseState();
    protected override MouseState GetMousePointerEventData(int id = 0)
    {
        // Populate the left button...
        PointerEventData leftData;
        var created = GetPointerData(kMouseLeftId, out leftData, true);
        leftData.Reset();
        
        
        if (created)
            leftData.position = m_cursorPos;

        Vector2 pos = m_cursorPos; // this position is the position i want 

        leftData.delta = pos - leftData.position;
        leftData.position = pos;
        leftData.scrollDelta = Input.mouseScrollDelta;
        leftData.button = PointerEventData.InputButton.Left;

        eventSystem.RaycastAll(leftData, m_RaycastResultCache);
        var raycast = FindFirstRaycast(m_RaycastResultCache);
        leftData.pointerCurrentRaycast = raycast;
        m_RaycastResultCache.Clear();

        // copy the apropriate data into right and middle slots
        PointerEventData rightData;
        GetPointerData(kMouseRightId, out rightData, true);
        CopyFromTo(leftData, rightData);
        rightData.button = PointerEventData.InputButton.Right;

        PointerEventData middleData;
        GetPointerData(kMouseMiddleId, out middleData, true);
        CopyFromTo(leftData, middleData);
        middleData.button = PointerEventData.InputButton.Middle;

        m_MouseState.SetButtonState(PointerEventData.InputButton.Left, StateForMouseButton(0), leftData);
        m_MouseState.SetButtonState(PointerEventData.InputButton.Right, StateForMouseButton(1), rightData);
        m_MouseState.SetButtonState(PointerEventData.InputButton.Middle, StateForMouseButton(2), middleData);

        return m_MouseState;
    }

    

}

