// $RawXml = [xml] $Template.GetXml()
// ($RawXml.toast.visual.binding.text | where { $_.id - eq "1"}).AppendChild($RawXml.CreateTextNode(@title)) > $null
// ($RawXml.toast.visual.binding.text | where { $_.id - eq "2"}).AppendChild($RawXml.CreateTextNode(@content)) > $null

import { spawn } from "child_process";

// $SerializedXml = New - Object Windows.Data.Xml.Dom.XmlDocument
// $SerializedXml.LoadXml($RawXml.OuterXml)
// $Toast = [Windows.UI.Notifications.ToastNotification]:: new ($SerializedXml)
// $Toast.Tag = "@tag"
// $Toast.Group = "@Application"
// $Toast.ExpirationTime = [DateTimeOffset]:: Now.AddMinutes(1)
const NOTIFICATION_SCRIPT = `
    [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null
    $Template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::@type)
    
    @setter
    
    [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("@app").Show($Template);`
export const enum ENotificationType {
    ImageTitleContent = "ToastImageAndText02",
    ImageContent = "ToastImageAndText01",
    TitleContent = "ToastText02",
    Content = "ToastText01"
}

const NotificationSetters = {
    [ENotificationType.ImageTitleContent]: `
    $Template.SelectSingleNode('//image[@id="1"]').SetAttribute('src', '@image')
    $Template.SelectSingleNode('//text[@id="1"]').InnerText = '@title'
    $Template.SelectSingleNode('//text[@id="2"]').InnerText = '@content'`,

    [ENotificationType.ImageContent]: `
    $Template.SelectSingleNode('//image[@id="1"]').SetAttribute('src', '@image')
    $Template.SelectSingleNode('//text[@id="1"]').InnerText = '@content'`,

    [ENotificationType.TitleContent]: `
    $Template.SelectSingleNode('//text[@id="1"]').InnerText = '@title'
    $Template.SelectSingleNode('//text[@id="2"]').InnerText = '@content'`,

    [ENotificationType.Content]: `$Template.SelectSingleNode('//text[@id="1"]').InnerText = '@content'`
}

export type NotificationOptions = { app: string; image?: string; title?: string; content?: string; }
//{ app: "test", content: "Example Notification" }

/**
 * 
 * @param options Notification Options
 * @returns The Shell process of the notification
 */
export function SendNotification(options: NotificationOptions = { app: 'test', content: "Sample Notification" }) {
    let notificationType: null | ENotificationType = null

    if (options.image) {
        if (options.title && options.content) {
            notificationType = ENotificationType.ImageTitleContent;
        } else if (options.content) {
            notificationType = ENotificationType.ImageContent;
        }
    }
    else if (options.title && options.content) {
        notificationType = ENotificationType.TitleContent;
    } else if (options.content) {
        notificationType = ENotificationType.Content;
    }

    if (!notificationType) {
        throw new Error("Invalid Notification Parameters")
    }

    let toastScript = NOTIFICATION_SCRIPT;

    toastScript = toastScript.replaceAll('@type', notificationType).replaceAll('@setter', NotificationSetters[notificationType])

    Object.keys(options).forEach((key) => {
        toastScript = toastScript.replaceAll(`@${key}`, options[key])
    })

    return spawn('powershell', [toastScript]);
}